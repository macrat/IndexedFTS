/**
 * Splitting text to n-gram
 *
 * @ignore
 */
function splitText(text, ngram=2) {
	const result = [];
	for (let i=0; i<text.length-ngram+1; i++) {
		result.push(text.slice(i, i+ngram));
	}
	return result;
}


/**
 * Make n-gram set by text.
 *
 * @ignore
 */
function tokenize(text, ngram=2) {
	return new Set(splitText(text, ngram));
}


/**
 * Parse queries.
 *
 * @ignore
 */
function splitQuery(query, ngram=2) {
	const result = {};
	query.split(/\s+/).filter(q => q.length > 0).forEach(q => result[q] = tokenize(q, ngram));
	return result;
}


/**
 * NoSuchColumnError means specified no indexed column.
 */
export class NoSuchColumnError {
	/**
	 * @param {object} column - name of errored column.
	 */
	constructor(column) {
		/**
		 * Column name that errored.
		 *
		 * @type {object}
		 */
		this.column = column;

		/**
		 * Human readable message.
		 *
		 * @type {string}
		 */
		this.message = this.column + ": no such column or no indexed"
	}

	/**
	 * Get message.
	 *
	 * @return {string}
	 */
	toString() {
		return this.message;
	}
}


/**
 * Promise like object for contents array.
 *
 * Almost methods are the same interface as {@link IndexedFTS} and {@link IFTSTransaction}.
 * But this class will processing all contents without using indexes.
 * Please consider using {@link IFTSTransaction} directly if it can.
 */
export class IFTSArrayPromise {
	/**
	 * @param {Set<string>} indexes - index names.
	 * @param {Promise<object[]>} promise - Promise for wrapping.
	 */
	constructor(indexes, promise) {
		/** @type {Set<string>} */
		this.indexes = indexes;

		/** @type {Promise<object[]>} */
		this.promise = promise;
	}

	/**
	 * Make resolved promise.
	 *
	 * @param {Set<string>} indexes - index names.
	 * @param {object[]} value - value for promise.
	 *
	 * @return {IFTSArrayPromise}
	 */
	static resolve(indexes, value=[]) {
		return new IFTSArrayPromise(indexes, Promise.resolve(value));
	}

	/**
	 * Make rejected promise.
	 *
	 * @param {Set<string>} indexes - index names.
	 * @param {object} value - value for promise.
	 *
	 * @return {IFTSArrayPromise}
	 */
	static reject(indexes, value=null) {
		return new IFTSArrayPromise(indexes, Promise.reject(value));
	}

	/**
	 * Set next function.
	 *
	 * @param {function(contents: object[]): *} fun - next function.
	 *
	 * @return {Promise}
	 */
	then(fun) {
		return this.promise.then(fun);
	}

	/**
	 * Set error handling function.
	 *
	 * @param {function(error: *): *} fun - error handling function.
	 *
	 * @return {Promise}
	 */
	catch(fun) {
		return this.promise.catch(fun);
	}

	/**
	 * Do something process for each elements and make a new IFTSArrayPromise.
	 *
	 * @param {function(content: object): object} fun - function for processing element.
	 *
	 * @return {IFTSArrayPromise}
	 */
	map(fun) {
		return new IFTSArrayPromise(this.indexes, this.then(xs => xs.map(fun)));
	}

	/**
	 * Filtering elements by function and make a new IFTSArrayPromise.
	 *
	 * @param {function(content: object): boolean} fun - function for filtering element.
	 *
	 * @return {IFTSArrayPromise}
	 */
	filter(fun) {
		return new IFTSArrayPromise(this.indexes, this.then(xs => xs.filter(fun)));
	}

	/**
	 * Checking index of column are exists and do {@link IFTSArrayPromise#filter}.
	 *
	 * @ignore
	 */
	_checkAndFilter(column, fun) {
		if (!this.indexes.has(column)) {
			return IFTSArrayPromise.reject(this.indexes, new NoSuchColumnError(column));
		}

		return this.filter(fun);
	}

	/**
	 * Get contents that have fully matched property.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	equals(column, value) {
		return this._checkAndFilter(column, x => x[column] === value);
	}

	/**
	 * Get contents that have property lower than value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	lower(column, value) {
		return this._checkAndFilter(column, x => x[column] < value);
	}

	/**
	 * Get contents that have property greater than value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	greater(column, value) {
		return this._checkAndFilter(column, x => x[column] > value);
	}

	/**
	 * Get contents that have property lower than value or equals value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	lowerOrEquals(column, value) {
		return this._checkAndFilter(column, x => x[column] <= value);
	}

	/**
	 * Get contents that have property greater than value or equals value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	greaterOrEquals(column, value) {
		return this._checkAndFilter(column, x => x[column] >= value);
	}

	/**
	 * Get contents that have property is between argument values.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} lower - minimal value.
	 * @param {object} upper - maximum value.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	between(column, lower, upper) {
		return this._checkAndFilter(column, x => lower <= x[column] && x[column] <= upper);
	}

	/**
	 * Get contents that have matched property by full-text search.
	 *
	 * WARNING: This method always processes all contents without using indexes.
	 * Please consider using {@link IFTSTransaction#search}.
	 *
	 * @param {object|object[]} columns - column names for search.
	 * @param {string} query - query for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	search(columns, query) {
		if (typeof columns === 'string') {
			columns = [columns];
		}

		for (let c of columns) {
			if (!this.indexes.has(c)) {
				return IFTSArrayPromise.reject(this.indexes, new NoSuchColumnError(c));
			}
		}

		const queries = [];
		for (let q in splitQuery(query)) {
			queries.push(q);
		}

		return this.filter(data => queries.every(q => columns.some(col => data[col].includes(q))));
	}
}


/**
 * Transaction.
 *
 * Almost methods are the same interface as {@link IndexedFTS} and {@link IFTSArrayPromise}.
 * Probably this class is faster than other classes in most cases.
 *
 * Please be careful, IFTSTransaction are sometimes makes a big cache.
 * Should not keep many transactions if not need.
 */
export class IFTSTransaction {
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
	 * @return {IFTSTransaction} returns self for method-chain.
	 */
	put(...contents) {
		const store = this.transaction.objectStore('data');
		const fts_indexes = [...this.db.fulltext_indexes].map(column => ({name: column, store: this.transaction.objectStore(this.db.index_prefix + column)}));

		return Promise.all(contents.map(data => {
			return new Promise((resolve, reject) => {
				const req = store.put(data);
				req.onsuccess = ev => resolve(ev.target.result);
				req.onerror = reject;
			}).then(key => {
				return Promise.all(fts_indexes.map(x => [...tokenize(data[x.name])].forEach(token => {
					return new Promise((resolve, reject) => {
						const req = x.store.put({
							key: key,
							token: token,
						});
						req.onsuccess = () => resolve([key, data]);
						req.onerror = reject;
					});
				})));
			});
		})).then(data => {
			data.forEach(kv => {
				this._cache[kv[0]] = kv[1];
			});
			return this;
		});
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
					this._cache[cursor.key] = cursor.value;
					result.push(cursor.value);
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
					this._cache[cursor.key] = cursor.value;
					result.push({key: cursor.key, data: cursor.value});
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
	 * @return {Promise<object|undefined>} content. will undefined if not found.
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
				this._cache[key] = ev.target.result;
				resolve(ev.target.result);
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

		if (this.db.primary_key === column) {
			return this._readCursor(this.transaction.objectStore('data').openCursor(keyRange));
		} else {
			return this._readCursor(this.transaction.objectStore('data').index(column).openCursor(keyRange));
		}
	}

	/**
	 * Get contents that have fully matched property.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
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
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
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
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
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
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
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
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
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
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	between(column, lower, upper) {
		return this._getAllWithIndex(column, this._KeyRange.bound(lower, upper, false, false));
	}

	/**
	 * Get contents that have matched property by full-text search.
	 *
	 * @param {object|object[]} columns - column names for search.
	 * @param {string} query - query for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	search(columns, query) {
		if (typeof columns === 'string') {
			columns = [columns];
		}

		for (let c of columns) {
			if (!this.db.indexes.has(c)) {
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
							founds = founds.flatten();

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


/**
 * Database of IndexedFTS.
 *
 * Almost methods are the same interface as {@link IDBTransaction} and {@link IFTSArrayPromise}.
 */
export default class IndexedFTS {
	/**
	 * @param {string} name - name of new (or open) database.
	 * @param {number} version - version of database.
	 * @param {Array<string|object>} schema - database schema.
	 * @param {object} options - other options.
	 * @param {object} options.scope - endpoints for IndexedDB API.
	 */
	constructor(name, version, schema, options) {
		/** @type {string} */
		this.index_prefix = options.index_prefix || 'indexedfts_';

		/** @type {object} */
		this.scope = options.scope || window;

		/** @type {string} */
		this.name = name;

		/** @type {number} */
		this.version = version;

		/** @type {object} */
		this.schema = schema;

		/** @type {object} */
		this.store_option = {autoIncrement: true};

		/** @type {string|null} */
		this.primary_key = null;

		/** @type {Set<string>} */
		this.fulltext_indexes = new Set();

		/** @type {Set<string>} */
		this.unique_indexes = new Set();

		/** @type {Set<string>} */
		this.normal_indexes = new Set();

		/** @type {IDBDatabase} */
		this.db = null;

		for (let x in schema) {
			if (schema[x] === 'primary' || schema[x].primary) {
				if ('keyPath' in this.store_option) {
					throw 'can not use multi primary key';
				}
				this.primary_key = x;
				this.store_option = {keyPath: x};
			} else if (schema[x] === 'unique' || schema[x].unique) {
				this.unique_indexes.add(x);
			} else {
				this.normal_indexes.add(x);
			}

			if (schema[x] === 'fulltext' || schema[x].fulltext) {
				this.fulltext_indexes.add(x);
			}
		}
	}

	/** @type {Set<string>} */
	get indexes() {
		const r = new Set([...this.fulltext_indexes, ...this.unique_indexes, ...this.normal_indexes]);
		if (this.primary_key !== null) {
			r.add(this.primary_key);
		}
		return r;
	}

	/**
	 * Open database.
	 *
	 * @return {Promise<undefined>}
	 */
	open() {
		return new Promise((resolve, reject) => {
			const request = this.scope.indexedDB.open(this.name, this.version);

			request.onsuccess = ev => {
				this.db = ev.target.result;
				resolve(this);
			};
			request.onerror = reject;

			request.onupgradeneeded = ev => {
				this.db = ev.target.result;

				const store = this.db.createObjectStore('data', this.store_option);

				store.onerror = reject;

				this.unique_indexes.forEach(x => {
					store.createIndex(x, x, {unique: true})
				});

				this.normal_indexes.forEach(x => {
					store.createIndex(x, x, {unique: true})
				});

				this.fulltext_indexes.forEach(column => {
					const fts_store = this.db.createObjectStore(this.index_prefix + column, {autoIncrement: true});
					fts_store.onerror = reject
					fts_store.createIndex('token', 'token', {unique: false});
					fts_store.createIndex('key', 'key', {unique: false});
					fts_store.createIndex(['token', 'key'], 'uni', {unique: true});
				});
			};
		});
	}

	/**
	 * Close database.
	 */
	close() {
		this.db.close();
	}

	/**
	 * Make new {@link IFTSTransaction}.
	 *
	 * @param {"readonly"|"readwrite"} mode - mode of transaction.
	 * @param {string[]|null} target - open index targets. open for all if null.
	 *
	 * @return {IFTSTransaction}
	 */
	transaction(mode='readonly', target=null) {
		if (target === null) {
			target = [...this.fulltext_indexes].map(x => this.index_prefix + x).concat(['data']);
		}
		return new IFTSTransaction(this, this.db.transaction(target, mode));
	}

	/**
	 * Put contents into database.
	 *
	 * @param {object} contents - contents for save. allowed multiple arguments.
	 *
	 * @return {IndexedFTS} returns self for method-chain.
	 */
	put(...contents) {
		return this.transaction('readwrite').put(...contents).then(() => this);
	}

	/**
	 * Get content by primary key.
	 *
	 * @param {object} key - the key of content.
	 *
	 * @return {Promise<object|undefined>} content. will undefined if not found.
	 */
	get(key) {
		return this.transaction('readonly', 'data').get(key);
	}

	/**
	 * Get filtered contents.
	 *
	 * @ignore
	 */
	_getFiltered(fun) {
		return fun(this.transaction('readonly', 'data'));
	}

	/**
	 * Get all contents.
	 *
	 * @return {IFTSArrayPromise} contents.
	 */
	getAll() {
		return this._getFiltered(x => x.getAll());
	}

	/**
	 * Get contents that have fully matched property.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	equals(column, value) {
		return this._getFiltered(x => x.equals(column, value));
	}

	/**
	 * Get contents that have property lower than value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	lower(column, value) {
		return this._getFiltered(x => x.lower(column, value));
	}

	/**
	 * Get contents that have property greater than value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	greater(column, value) {
		return this._getFiltered(x => x.greater(column, value));
	}

	/**
	 * Get contents that have property lower than value or equals value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	lowerOrEquals(column, value) {
		return this._getFiltered(x => x.lowerOrEquals(column, value));
	}

	/**
	 * Get contents that have property greater than value or equals value.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} value - value for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	greaterOrEquals(column, value) {
		return this._getFiltered(x => x.greaterOrEquals(column, value));
	}

	/**
	 * Get contents that have property is between argument values.
	 *
	 * @param {object} column - column name for search.
	 * @param {object} lower - minimal value.
	 * @param {object} upper - maximum value.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	between(column, lower, upper) {
		return this._getFiltered(x => x.between(column, lower, upper));
	}

	/**
	 * Get contents that have matched property by full-text search.
	 *
	 * @param {object|object[]} columns - column names for search.
	 * @param {string} query - query for search.
	 *
	 * @throws {NoSuchColumnError} when column was no indexed.
	 *
	 * @return {IFTSArrayPromise} matched contents.
	 */
	search(columns, query) {
		return this.transaction().search(columns, query);
	}
}
