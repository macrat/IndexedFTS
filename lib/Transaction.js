import {tokenize, splitQuery, splitWords, fastMap, flatten, dedup} from './utils';
import {NoSuchColumnError, InvalidKeyError} from './errors';
import IFTSArrayPromise from './ArrayPromise';


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
		const ngram_indexes = fastMap([...this.db.schema.ngramIndexes], column => ({name: column, store: this.transaction.objectStore(this.db.index_prefix + 'ngram_' + column)}));
		const word_indexes = fastMap([...this.db.schema.wordIndexes], column => ({name: column, store: this.transaction.objectStore(this.db.index_prefix + 'word_' + column)}));

		const putPromises = new Array(contents.length);
		for (let i=0; i<contents.length; i++) {
			putPromises[i] = new Promise((resolve, reject) => {
				const req = store.put(contents[i]);
				req.onerror = reject;
				req.onsuccess = ev => {
					resolve(
						this._updateNGramIndex(ev.target.result, contents[i], ngram_indexes)
							.then(() => this._updateWordIndex(ev.target.result, contents[i], word_indexes)))
				};
			});
		}

		return Promise.all(putPromises).then(data => {
			for (let i=0; i<data.length; i++) {
				const key = data[i][0];
				const value = data[i][1];
				if (this.db.schema.primaryKey === null) {
					value._key = key;
				}
				this._cache[key] = value;
			}
			return this;
		});
	}

	/**
	 * Update ngram index.
	 *
	 * @ignore
	 */
	_updateNGramIndex(key, data, ngram_indexes) {
		return this._deleteIndex(key, ngram_indexes.map(x => this.db.index_prefix + 'ngram_' + x.name))
			.then(() => Promise.all(fastMap(ngram_indexes, col => {
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
	 * Update word index.
	 *
	 * @ignore
	 */
	_updateWordIndex(key, data, word_indexes) {
		return this._deleteIndex(key, word_indexes.map(x => this.db.index_prefix + 'word_' + x.name))
			.then(() => Promise.all(fastMap(word_indexes, col => {
				const words = splitWords(data[col.name]);
				const promises = new Array(words.length);
				for (let i=0; i<words.length; i++) {
					promises[i] = new Promise((resolve, reject) => {
						const req = col.store.put({
							key: key,
							word: words[i],
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
	 * Delete content by FTS indexes of database.
	 *
	 * @ignore
	 */
	_deleteIndex(key, tableNames) {
		return Promise.all(tableNames.map(table => {
			return new Promise((resolve, reject) => {
				const store = this.transaction.objectStore(table);
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
	 * @return {Promise<IFTSTransaction>} returns self for chain. Will reject with {@link InvalidKeyError} if keys included null or undefined.
	 */
	delete(...keys) {
		for (let i=0; i<keys.length; i++) {
			if (keys[i] === null || keys[i] === undefined) {
				return Promise.reject(new InvalidKeyError(keys[i]));
			}
		}

		return Promise.all(fastMap(keys, key => {
			return new Promise((resolve, reject) => {
				const req = this.transaction.objectStore('data').delete(key);
				req.onerror = reject;
				req.onsuccess = resolve;
			})
			.then(() => this._deleteIndex(key, [
				...[...this.db.schema.ngramIndexes].map(x => this.db.index_prefix + 'ngram_' + x),
				...[...this.db.schema.wordIndexes].map(x => this.db.index_prefix + 'word_' + x),
			]))
		})).then(() => this);
	}

	/**
	 * Make {@link IFTSArrayPromise} by cursor.
	 *
	 * @ignore
	 */
	_readCursor(cursorRequest, filter=null, map=null, limit=undefined) {
		filter = filter || ((x, i) => true);
		map = map || ((x, i) => x);

		return new IFTSArrayPromise(this.db.schema.indexes, new Promise((resolve, reject) => {
			const result = [];
			let index = 0;

			cursorRequest.onsuccess = ev => {
				const cursor = ev.target.result;
				if (cursor) {
					const value = cursor.value;
					if (this.db.schema.primaryKey === null) {
						value._key = cursor.key;
					}
					this._cache[cursor.key] = value;
					if (filter(value, index)) {
						result.push(map(value, index));
					}

					index++;
					if (limit === undefined || index < limit) {
						cursor.continue();
					} else {
						resolve(result);
					}
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
		return new IFTSArrayPromise(this.db.schema.indexes, new Promise((resolve, reject) => {
			const request = this.transaction.objectStore('data').openCursor();

			const result = [];
			request.onsuccess = ev => {
				const cursor = ev.target.result;
				if (cursor) {
					const value = cursor.value;
					if (this.db.schema.primaryKey === null) {
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
	 * Do something process for each elements and returns {@link IFTSArrayPromise}.
	 *
	 * NOTE: This method doesn't fast. May better do filtering before doing map if need filtering.
	 *
	 * @param {function(content: object, index: Number): object} fun - function for processing element.
	 *
	 * @return {IFTSArrayPromise}
	 */
	map(fun) {
		return this._readCursor(this.transaction.objectStore('data').openCursor(null), null, fun);
	}

	/**
	 * Filtering elements by function and returns {@link IFTSArrayPromise}.
	 *
	 * WARNING: This method won't use the index. Other methods(eg. {@link IFTSTransaction#equals} or {@link IFTSTransaction#lower} may faster than this.
	 *
	 * @param {function(content: object, index: Number): object} fun - function for filtering element.
	 *
	 * @return {IFTSArrayPromise}
	 */
	filter(fun) {
		return this._readCursor(this.transaction.objectStore('data').openCursor(null), fun, null);
	}

	/**
	 * Sort and get all contents.
	 *
	 * @param {object} column - the column for sorting.
	 * @param {'asc'|'desc'} [order='asc'] - sort order.
	 * @param {Number} [offset=0] - starting offset of the result.
	 * @param {Number} [limit] - maximum number of result length. will unlimited if omitted.
	 *
	 * @return {IFTSArrayPromise} sorted contents.
	 */
	sort(column, order='asc', offset=0, limit=undefined) {
		if (!this.db.schema.indexes.has(column)) {
			return IFTSArrayPromise.reject(this.db.schema.indexes, new NoSuchColumnError(column));
		}

		limit = limit === undefined ? undefined : offset + limit;
		const offsetFilter = (x, i) => offset <= i;

		const store = this.transaction.objectStore('data');

		if (column === this.db.schema.primaryKey) {
			return this._readCursor(store.openCursor(null, order === 'desc' ? 'prev' : 'next'), offsetFilter, null, limit);
		} else {
			return this._readCursor(store.index(column).openCursor(null, order === 'desc' ? 'prev' : 'next'), offsetFilter, null, limit);
		}
	}

	/**
	 * Get content by primary key.
	 *
	 * @param {object} key - the key of content.
	 *
	 * @return {Promise<object|undefined>} content. promise will reject with {@link InvalidKeyError} if keys included null or undefined. result value will be undefined if not found.
	 */
	get(key) {
		if (key === null || key === undefined) {
			return Promise.reject(new InvalidKeyError(key));
		}
		if (key in this._cache) {
			return Promise.resolve(this._cache[key]);
		}
		return new Promise((resolve, reject) => {
			const req = this.transaction.objectStore('data').get(key);
			req.onsuccess = ev => {
				const value = ev.target.result;
				if (this.db.schema.primaryKey === null) {
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
		if (!this.db.schema.indexes.has(column)) {
			return IFTSArrayPromise.reject(this.db.schema.indexes, new NoSuchColumnError(column));
		}

		const store = this.transaction.objectStore('data');

		if (column === this.db.schema.primaryKey) {
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
	 * Get candidates of search result.
	 *
	 * @ignore
	 */
	_takeCandidatesBySingleColumn(column, queries) {
		const index = this.transaction.objectStore(this.db.index_prefix + 'ngram_' + column).index('token');
		const result = [];

		for (let q in queries) {
			if (queries[q].length === 0) {
				result.push(this._getAllWithKeys().filter(x => x.data[column].includes(q)).map(x => x.key).then(xs => ({query: q, keys: xs})));
				continue;
			}

			const promises = new Array(queries[q].length);
			for (let i=0; i<queries[q].length; i++) {
				promises[i] = this._readCursor(index.openCursor(queries[q][i]), null, data => data.key);
			}

			const candidate = Promise.all(promises)
				.then(founds => {
					if (founds.length === 0) {
						return Promise.resolve([]);
					}

					founds = flatten(founds);

					const deduped = new Array(founds.length);
					let dedup_num = 0;
					const hit_count = {};
					for (let i=0; i<founds.length; i++) {
						if (!(founds[i] in hit_count)) {
							hit_count[founds[i]] = 0;

							deduped[dedup_num] = founds[i];
							dedup_num++;
						}
						hit_count[founds[i]]++;
					}

					const candidates = new Array(dedup_num);
					let candidate_num = 0;
					for (let i=0; i<dedup_num; i++) {
						if (hit_count[deduped[i]] >= queries[q].length) {
							candidates[candidate_num] = this.get(deduped[i]).then(data => ({key: deduped[i], data: data}));
							candidate_num++;
						}
					}
					return Promise.all(candidates.slice(0, candidate_num));
				})
				.then(xs => ({query: q, keys: xs.filter(x => x.data[column].includes(q)).map(x => x.key)}))

			result.push(candidate);
		}

		return result;
	}

	/**
	 * Prune contents by result of {@link IFTSTransaction#_takeCandidatesBySingleColumn}.
	 *
	 * @ignore
	 */
	async _pruneCandidates(queries_num, candidates) {
		const keys = {};

		for (let i=0; i<candidates.length; i++) {
			for (let j=0; j<candidates[i].keys.length; j++) {
				if (!(candidates[i].keys[j] in keys)) {
					keys[candidates[i].keys[j]] = new Set();
				}
				keys[candidates[i].keys[j]].add(candidates[i].query);
			}
		}

		const result = new Array(candidates.length);
		let result_num = 0;
		for (let key in keys) {
			if (keys[key].size == queries_num) {
				result[result_num] = this.get(key);
				result_num++;
			}
		}

		return await Promise.all(result.slice(0, result_num));
	}

	/**
	 * Get contents that have matched property by full-text search.
	 *
	 * All target columns have to made ngram index when created database.
	 * If you didn't made ngram index, you can use {@link IFTSArrayPromise#search} (but this way is very slow).
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

		for (let i=0; i<columns.length; i++) {
			if (!this.db.schema.ngramIndexes.has(columns[i])) {
				return IFTSArrayPromise.reject(this.db.schema.indexes, new NoSuchColumnError(columns[i]));
			}
		}

		const queries = splitQuery(query);
		let queries_length = 0;

		for (let q in queries) {
			queries[q] = fastMap(queries[q], x => this._KeyRange.only(x));
			queries_length++;
		}

		const candidatePromises = [];

		for (let i=0; i<columns.length; i++) {
			Array.prototype.push.apply(candidatePromises, this._takeCandidatesBySingleColumn(columns[i], queries));
		}

		return new IFTSArrayPromise(
			this.db.schema.indexes,
			Promise.all(candidatePromises).then(xs => this._pruneCandidates(queries_length, xs)),
		);
	}

	/**
	 * Find contents that have fully matched word in property.
	 *
	 * All target columns have to made word index when created database.
	 * If you didn't made word index, you can use {@link IFTSArrayPromise#searchWord} (but this way is very slow).
	 *
	 *
	 * @param {object|object[]} columns - column names for search.
	 * @param {string} query - query for search.
	 *
	 * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
	 */
	searchWord(columns, query) {
		if (typeof columns === 'string') {
			columns = [columns];
		}

		for (let i=0; i<columns.length; i++) {
			if (!this.db.schema.wordIndexes.has(columns[i])) {
				return IFTSArrayPromise.reject(this.db.schema.indexes, new NoSuchColumnError(columns[i]));
			}
		}

		const queries = splitWords(query).map(x => ({text: x, keyRange: this._KeyRange.only(x)}));

		return new IFTSArrayPromise(this.db.schema.indexes, Promise.all(flatten(columns.map(col => {
			const index = this.transaction.objectStore(this.db.index_prefix + 'word_' + col).index('word');

			return queries.map(query => this._readCursor(index.openCursor(query.keyRange), null, data => [data.key, query.text]));
		}))).then(candidates => {
			candidates = dedup(flatten(candidates));

			const counts = {};
			for (let i=0; i<candidates.length; i++) {
				const key = candidates[i][0];
				if (!(key in counts)) {
					counts[key] = 0;
				}
				counts[key]++;
			}

			const hits = new Array(candidates.length);
			let hits_count = 0;
			for (let i=0; i<candidates.length; i++) {
				const key = candidates[i][0];
				if (counts[key] >= queries.length) {
					hits[hits_count] = key;
					hits_count++;
				}
			}

			const result = new Array(hits_count);
			for (let i=0; i<hits_count; i++) {
				result[i] = this.get(hits[i]);
			}
			return new IFTSArrayPromise(this.db.schema.indexes, Promise.all(result));
		}));
	}

	/**
	 * Get N-Gram set from index.
	 *
	 * @param {string} column - name of column.
	 *
	 * @return {Promise<Map<string, number>>}
	 */
	getNGrams(column) {
		if (!this.db.schema.ngramIndexes.has(column)) {
			return Promise.reject(new NoSuchColumnError(column));
		}

		const result = new Map();

		const cursor = this.transaction.objectStore(this.db.index_prefix + 'ngram_' + column).openCursor();
		return new Promise((resolve, reject) => {
			cursor.onsuccess = ev => {
				const cursor = ev.target.result;
				if (cursor) {
					result.set(cursor.value.token, (result.get(cursor.value.token) || 0) + 1);
					cursor.continue();
				} else {
					resolve(result);
				}
			}
			cursor.onerror = ev => reject(ev);
		});
	}

	/**
	 * Get word set from index.
	 *
	 * @param {string} column - name of column.
	 *
	 * @return {Promise<Map<string, number>>}
	 */
	getWords(column) {
		if (!this.db.schema.wordIndexes.has(column)) {
			return Promise.reject(new NoSuchColumnError(column));
		}

		const result = new Map();

		const cursor = this.transaction.objectStore(this.db.index_prefix + 'word_' + column).openCursor();
		return new Promise((resolve, reject) => {
			cursor.onsuccess = ev => {
				const cursor = ev.target.result;
				if (cursor) {
					result.set(cursor.value.word, (result.get(cursor.value.word) || 0) + 1);
					cursor.continue();
				} else {
					resolve(result);
				}
			}
			cursor.onerror = ev => reject(ev);
		});
	}
}
