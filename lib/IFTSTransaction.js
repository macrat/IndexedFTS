import {tokenize, splitQuery, fastMap} from './utils';
import {NoSuchColumnError} from './errors';
import IFTSArrayPromise from './IFTSArrayPromise';


/**
 * Transaction.
 *
 * Almost methods are the same interface as {@link IndexedFTS} and {@link IFTSArrayPromise}.
 * Probably this class is faster than other classes in most cases.
 *
 * Please be careful, IFTSTransaction are sometimes makes a big cache.
 * Should not keep many transactions if not need.
 */
export default class IFTSTransaction {
	/**
	 * @param {IndexedFTS} db - database.
	 * @param {IDBTransaction} transaction - transaction of IndexedDB.
	 */
	constructor(db, transaction) {
		/** @type {IndexedDB} */
		this.db = db;

		/** @type {IDBTransaction} */
		this.transaction = transaction;

		/** @ignore */
		this._KeyRange = this.db.scope.IDBKeyRange;

		/**
		 * Promise for await closing transaction.
		 *
		 * @type {Promise<IndexedDB>}
		 */
		this.promise = new Promise((resolve, reject) => {
			this.transaction.oncomplete = () => resolve(this.db);
			this.transaction.onerror = err => reject(err);
		});

		/** @ignore */
		this._cache = {};
	}

	/**
	 * Put contents into database.
	 *
	 * @param {object} contents - contents for save. allowed multiple arguments.
	 *
	 * @return {Promise<IFTSTransaction>} returns self for chain.
	 */
	put(...contents) {
		const store = this.transaction.objectStore('data');
		const fts_indexes = fastMap([...this.db.fulltext_indexes], column => ({name: column, store: this.transaction.objectStore(this.db.index_prefix + column)}));

		const putPromises = new Array(contents.length);
		for (let i=0; i<contents.length; i++) {
			putPromises[i] = new Promise((resolve, reject) => {
				const req = store.put(contents[i]);
				req.onerror = reject;
				req.onsuccess = ev => resolve(this._updateIndex(ev.target.result, contents[i], fts_indexes));
			});
		}

		return Promise.all(putPromises).then(data => {
			for (let i=0; i<data.length; i++) {
				const key = data[i][0];
				const value = data[i][1];
				if (this.db.primary_key === null) {
					value._key = key;
				}
				this._cache[key] = value;
			}
			return this;
		});
	}

	/**
	 * Update index for full-text search.
	 *
	 * @ignore
	 */
	_updateIndex(key, data, fts_indexes) {
		return this._deleteIndex(key)
			.then(() => Promise.all(fastMap(fts_indexes, col => {
				const tokens = tokenize(data[col.name]);
				const promises = new Array(tokens.length);
				for (let i=0; i<tokens.length; i++) {
					promises[i] = new Promise((resolve, reject) => {
						const req = col.store.put({
							key: key,
							token: tokens[i],
						});
						req.onsuccess = () => resolve();
						req.onerror = reject;
					});
				}
				return Promise.all(promises);
			})))
			.then(() => [key, data]);
	}

	/**
	 * Delete FTS index from database.
	 *
	 * @ignore
	 */
	_deleteIndex(key) {
		return Promise.all([...this.db.fulltext_indexes].map(col => {
			return new Promise((resolve, reject) => {
				const store = this.transaction.objectStore(this.db.index_prefix + col);
				store.onerror = reject;

				const requests = [];

				const req = store.index('key').openKeyCursor(this._KeyRange.only(key));
				req.onerror = reject;
				req.onsuccess = ev => {
					const cursor = ev.target.result;
					if (cursor) {
						requests.push(new Promise((resolve, reject) => {
							const d = store.delete(cursor.primaryKey);
							d.onsuccess = resolve;
							d.onerror = reject
						}));
						cursor.continue();
					} else {
						resolve(Promise.all(requests));
					}
				}
			});
		}));
	}

	/**
	 * Delete contents from database.
	 *
	 * @param {object} keys - key of contents. allowed multiple arguments.
	 *
	 * @return {Promise<IFTSTransaction>} returns self for chain.
	 */
	delete(...keys) {
		for (let key of keys) {
			if (key === null || key === undefined) {
				return Promise.reject('invalid key');
			}
		}

		return Promise.all(fastMap(keys, key => {
			return new Promise((resolve, reject) => {
				const req = this.transaction.objectStore('data').delete(key);
				req.onerror = reject;
				req.onsuccess = resolve;
			}).then(() => this._deleteIndex(key));
		})).then(() => this);
	}

	/**
	 * Make {@link IFTSArrayPromise} by cursor.
	 *
	 * @ignore
	 */
	_readCursor(cursorRequest) {
		return new IFTSArrayPromise(this.db.indexes, new Promise((resolve, reject) => {
			const result = [];

			cursorRequest.onsuccess = ev => {
				const cursor = ev.target.result;
				if (cursor) {
					const value = cursor.value;
					if (this.db.primary_key === null) {
						value._key = cursor.key;
					}
					this._cache[cursor.key] = value;
					result.push(value);
					cursor.continue();
				} else {
					resolve(result);
				}
			};
			cursorRequest.onerror = err => reject(err);
		}));
	}

	/**
	 * Get all contents.
	 *
	 * @return {IFTSArrayPromise} contents.
	 */
	getAll() {
		return this._readCursor(this.transaction.objectStore('data').openCursor());
	}

	/**
	 * Get all contents with primary keys.
	 *
	 * @ignore
	 */
	_getAllWithKeys() {
		return new IFTSArrayPromise(this.db.indexes, new Promise((resolve, reject) => {
			const request = this.transaction.objectStore('data').openCursor();

			const result = [];
			request.onsuccess = ev => {
				const cursor = ev.target.result;
				if (cursor) {
					const value = cursor.value;
					if (this.db.primary_key === null) {
						value._key = cursor.key;
					}
					this._cache[cursor.key] = value;
					result.push({key: cursor.key, data: value});
					cursor.continue();
				} else {
					resolve(result);
				}
			};

			request.onerror = err => reject(err);
		}));
	}

	/**
	 * Get content by primary key.
	 *
	 * @param {object} key - the key of content.
	 *
	 * @return {Promise<object|undefined>} content. result value will be undefined if not found.
	 */
	get(key) {
		if (key === null || key === undefined) {
			return Promise.reject('invalid key');
		}
		if (key in this._cache) {
			return Promise.resolve(this._cache[key]);
		}
		return new Promise((resolve, reject) => {
			const req = this.transaction.objectStore('data').get(key);
			req.onsuccess = ev => {
				const value = ev.target.result;
				if (this.db.primary_key === null) {
					value._key = key;
				}
				this._cache[key] = value;
				resolve(value);
			};
			req.onerror = reject;
		});
	}

	/**
	 * Get contents matched keyRange.
	 *
	 * @ignore
	 */
	_getAllWithIndex(column, keyRange) {
		if (!this.db.indexes.has(column)) {
			return IFTSArrayPromise.reject(this.db.indexes, new NoSuchColumnError(column));
		}

		const store = this.transaction.objectStore('data');

		if (column === this.db.primary_key) {
			return this._readCursor(store.openCursor(keyRange));
		} else {
			return this._readCursor(store.index(column).openCursor(keyRange));
		}
	}

	/**
	 * Get contents that have fully matched property.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
	 */
	equals(column, value) {
		return this._getAllWithIndex(column, this._KeyRange.only(value));
	}

	/**
	 * Get contents that have property lower than value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
	 */
	lower(column, value) {
		return this._getAllWithIndex(column, this._KeyRange.upperBound(value, true));
	}

	/**
	 * Get contents that have property greater than value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
	 */
	greater(column, value) {
		return this._getAllWithIndex(column, this._KeyRange.lowerBound(value, true));
	}

	/**
	 * Get contents that have property lower than value or equals value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
	 */
	lowerOrEquals(column, value) {
		return this._getAllWithIndex(column, this._KeyRange.upperBound(value, false));
	}

	/**
	 * Get contents that have property greater than value or equals value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
	 */
	greaterOrEquals(column, value) {
		return this._getAllWithIndex(column, this._KeyRange.lowerBound(value, false));
	}

	/**
	 * Get contents that have property is between argument values.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} lower - minimal value.
	 * @param {object} upper - maximum value.
	 *
	 * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
	 */
	between(column, lower, upper) {
		return this._getAllWithIndex(column, this._KeyRange.bound(lower, upper, false, false));
	}

	/**
	 * Get contents that have matched property by full-text search.
	 *
	 * All target columns have to made fulltext index when created database.
	 * If you didn't made fulltext index, you can use {@link IFTSArrayPromise#search} (but this way is very slow).
	 *
	 *
	 * @param {object|object[]} columns - column names for search.
	 * @param {string} query - query for search.
	 *
	 * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
	 */
	search(columns, query) {
		if (typeof columns === 'string') {
			columns = [columns];
		}

		for (let c of columns) {
			if (!this.db.fulltext_indexes.has(c)) {
				return IFTSArrayPromise.reject(this.db.indexes, new NoSuchColumnError(c));
			}
		}

		const queries = splitQuery(query);
		let queries_length = 0;

		for (let q in queries) {
			queries[q] = [...queries[q]].map(x => this._KeyRange.only(x));
			queries_length++;
		}

		return new IFTSArrayPromise(this.db.indexes, new Promise((resolve, reject) => {
			const promises = [];

			columns.forEach(col => {
				const index = this.transaction.objectStore(this.db.index_prefix + col).index('token');
				index.onerror = reject;

				for (let q in queries) {
					if (queries[q].length === 0) {
						promises.push(this._getAllWithKeys().filter(x => x.data[col].includes(q)).map(x => x.key).then(xs => ({query: q, keys: xs})));
						continue;
					}

					promises.push(Promise.all(queries[q].map(token => this._readCursor(index.openCursor(token)).map(data => data.key)))
						.then(founds => {
							if (founds.length === 0) {
								return Promise.resolve([]);
							}

							founds = Array.prototype.concat.apply([], founds);

							const hit_count = {};
							founds.forEach(key => {
								if (!(key in hit_count)) {
									hit_count[key] = 0;
								}
								hit_count[key]++;
							});

							const candidate_keys = [...new Set(founds)].filter(key => hit_count[key] >= queries[q].length);

							return Promise.all(candidate_keys.map(k => this.get(k).then(x => ({key: k, data: x}))));
						})
						.then(xs => ({query: q, keys: xs.filter(x => x.data[col].includes(q)).map(x => x.key)})));
				}
			});

			resolve(Promise.all(promises).then(xs => {
				const keys = {};

				xs.forEach(x => {
					x.keys.forEach(k => {
						if (!(k in keys)) {
							keys[k] = new Set();
						}
						keys[k].add(x.query);
					});
				});

				const result = [];
				for (let key in keys) {
					if (keys[key].size == queries_length) {
						result.push(this.get(key));
					}
				}

				return this.db.indexes, Promise.all(result);
			}));
		}));
	}
}
