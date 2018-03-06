(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.IndexedFTS = {})));
}(this, (function (exports) { 'use strict';

/**
 * Splitting text to n-gram
 *
 * @ignore
 */
function splitText(text, ngram = 2) {
	const result = [];
	for (let i = 0; i < text.length - ngram + 1; i++) {
		result.push(text.slice(i, i + ngram));
	}
	return result;
}

/**
 * Splitting text to words
 *
 * @ignore
 */
function splitWords(text) {
	return dedup(text.split(/\s+/).filter(x => x.length > 0));
}

/**
 * Make n-gram set by text.
 *
 * @ignore
 */
function tokenize(text, ngram = 2) {
	return dedup(splitText(text, ngram));
}

/**
 * Parse queries.
 *
 * @ignore
 */
function splitQuery(query, ngram = 2) {
	const result = {};
	query.split(/\s+/).filter(q => q.length > 0).forEach(q => result[q] = tokenize(q, ngram));
	return result;
}

/**
 * Deduplication from Array
 *
 * @ignore
 */
function dedup(array) {
	const result = new Array(array.length);
	const index = new Set();
	let idx = 0;

	for (let i = 0; i < array.length; i++) {
		if (!index.has(array[i])) {
			index.add(array[i]);
			result[idx] = array[i];
			idx++;
		}
	}

	return result.slice(0, idx);
}

/**
 * Faster Array.prototype.map
 *
 * @ignore
 */
function fastMap(array, fun) {
	const result = new Array(array.length);
	for (let i = 0; i < array.length; i++) {
		result[i] = fun(array[i]);
	}
	return result;
}

/**
 * Flatten nested array
 *
 * @ignore
 */
function flatten(array) {
	let length = 0;
	for (let i = 0; i < array.length; i++) {
		length += array[i].length;
	}

	const result = new Array(length);
	let idx = 0;
	for (let i = 0; i < array.length; i++) {
		for (let j = 0; j < array[i].length; j++) {
			result[idx] = array[i][j];
			idx++;
		}
	}

	return result;
}

/**
 * NoSuchColumnError means specified no indexed column.
 */
class NoSuchColumnError extends Error {
	/**
  * @param {object} column - name of errored column.
  */
	constructor(column) {
		super(column + ': no such column or no indexed');

		/**
   * Column name that errored.
   *
   * @type {object}
   */
		this.column = column;

		/** @ignore */
		this.name = '';

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, NoSuchColumnError);
		}
	}
}

/**
 * InvalidKeyError means specified invalid key.
 */
class InvalidKeyError extends Error {
	/**
  * @param {object} key - name of specified key.
  */
	constructor(key) {
		super('invalid key');

		/**
   * Key name that specified.
   *
   * @type {object}
   */
		this.key = key;

		/** @ignore */
		this.name = '';

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, InvalidKeyError);
		}
	}
}

/**
 * Promise like object for contents array.
 *
 * Almost methods are the same interface as {@link IndexedFTS} and {@link IFTSTransaction}.
 * But this class will processing all contents without using indexes.
 * Please consider using {@link IFTSTransaction} directly if it can.
 */
class IFTSArrayPromise {
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
	static resolve(indexes, value = []) {
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
	static reject(indexes, value = null) {
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
  * @param {function(content: object, index: Number): object} fun - function for processing element.
  *
  * @return {IFTSArrayPromise}
  */
	map(fun) {
		return new IFTSArrayPromise(this.indexes, this.then(xs => xs.map(fun)));
	}

	/**
  * Filtering elements by function and make a new IFTSArrayPromise.
  *
  * @param {function(content: object, index: Number): boolean} fun - function for filtering element.
  *
  * @return {IFTSArrayPromise}
  */
	filter(fun) {
		return new IFTSArrayPromise(this.indexes, this.then(xs => xs.filter(fun)));
	}

	/**
  * Sort contents.
  *
  * @param {object} column - the column for sorting.
  * @param {'asc'|'desc'} [order='asc'] - sort order.
  * @param {Number} [offset=0] - starting offset of the result.
  * @param {Number} [limit] - maximum number of result length. will unlimited if omitted.
  *
  * @return {IFTSArrayPromise} sorted contents.
  */
	sort(column, order = 'asc', offset = 0, limit = undefined) {
		if (!this.indexes.has(column)) {
			return IFTSArrayPromise.reject(this.indexes, new NoSuchColumnError(column));
		}

		return new IFTSArrayPromise(this.indexes, this.then(xs => Array.prototype.concat.call([], xs).sort((x, y) => {
			if (x[column] < y[column]) {
				return order === 'desc' ? 1 : -1;
			} else if (x[column] > y[column]) {
				return order === 'desc' ? -1 : 1;
			} else {
				return 0;
			}
		}).slice(offset, limit === undefined ? undefined : offset + limit)));
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
  * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
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
  * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
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
  * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
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
  * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
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
  * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
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
  * @return {IFTSArrayPromise} matched contents. may reject with {@link NoSuchColumnError}.
  */
	between(column, lower, upper) {
		return this._checkAndFilter(column, x => lower <= x[column] && x[column] <= upper);
	}

	/**
  * Get contents that have matched property by full-text search.
  *
  * This method can search even if didn't made ngram index.
  *
  * WARNING: This method always processes all contents without using indexes.
  * Please consider using {@link IFTSTransaction#search}.
  *
  *
  * @param {object|object[]} columns - column names for search.
  * @param {string} query - query for search.
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

	/**
  * Find contents that have fully matched word in property.
  *
  * This method can search even if didn't made word index.
  *
  * WARNING: This method always processes all contents without using indexes.
  * Please consider using {@link IFTSTransaction#searchWord}.
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

		for (let c of columns) {
			if (!this.indexes.has(c)) {
				return IFTSArrayPromise.reject(this.indexes, new NoSuchColumnError(c));
			}
		}

		const queries = splitWords(query);

		return this.filter(data => queries.every(q => columns.some(col => {
			return splitWords(data[col]).includes(q);
		})));
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
class IFTSTransaction {
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
		const ngram_indexes = fastMap([...this.db.ngram_indexes], column => ({ name: column, store: this.transaction.objectStore(this.db.index_prefix + 'ngram_' + column) }));
		const word_indexes = fastMap([...this.db.word_indexes], column => ({ name: column, store: this.transaction.objectStore(this.db.index_prefix + 'word_' + column) }));

		const putPromises = new Array(contents.length);
		for (let i = 0; i < contents.length; i++) {
			putPromises[i] = new Promise((resolve, reject) => {
				const req = store.put(contents[i]);
				req.onerror = reject;
				req.onsuccess = ev => {
					resolve(this._updateNGramIndex(ev.target.result, contents[i], ngram_indexes).then(() => this._updateWordIndex(ev.target.result, contents[i], word_indexes)));
				};
			});
		}

		return Promise.all(putPromises).then(data => {
			for (let i = 0; i < data.length; i++) {
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
  * Update ngram index.
  *
  * @ignore
  */
	_updateNGramIndex(key, data, ngram_indexes) {
		return this._deleteIndex(key, ngram_indexes.map(x => this.db.index_prefix + 'ngram_' + x.name)).then(() => Promise.all(fastMap(ngram_indexes, col => {
			const tokens = tokenize(data[col.name]);
			const promises = new Array(tokens.length);
			for (let i = 0; i < tokens.length; i++) {
				promises[i] = new Promise((resolve, reject) => {
					const req = col.store.put({
						key: key,
						token: tokens[i]
					});
					req.onsuccess = () => resolve();
					req.onerror = reject;
				});
			}
			return Promise.all(promises);
		}))).then(() => [key, data]);
	}

	/**
  * Update word index.
  *
  * @ignore
  */
	_updateWordIndex(key, data, word_indexes) {
		return this._deleteIndex(key, word_indexes.map(x => this.db.index_prefix + 'word_' + x.name)).then(() => Promise.all(fastMap(word_indexes, col => {
			const words = splitWords(data[col.name]);
			const promises = new Array(words.length);
			for (let i = 0; i < words.length; i++) {
				promises[i] = new Promise((resolve, reject) => {
					const req = col.store.put({
						key: key,
						word: words[i]
					});
					req.onsuccess = () => resolve();
					req.onerror = reject;
				});
			}
			return Promise.all(promises);
		}))).then(() => [key, data]);
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
							d.onerror = reject;
						}));
						cursor.continue();
					} else {
						resolve(Promise.all(requests));
					}
				};
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
		for (let i = 0; i < keys.length; i++) {
			if (keys[i] === null || keys[i] === undefined) {
				return Promise.reject(new InvalidKeyError(keys[i]));
			}
		}

		return Promise.all(fastMap(keys, key => {
			return new Promise((resolve, reject) => {
				const req = this.transaction.objectStore('data').delete(key);
				req.onerror = reject;
				req.onsuccess = resolve;
			}).then(() => this._deleteIndex(key, [...[...this.db.ngram_indexes].map(x => this.db.index_prefix + 'ngram_' + x), ...[...this.db.word_indexes].map(x => this.db.index_prefix + 'word_' + x)]));
		})).then(() => this);
	}

	/**
  * Make {@link IFTSArrayPromise} by cursor.
  *
  * @ignore
  */
	_readCursor(cursorRequest, filter = null, map = null, limit = undefined) {
		filter = filter || ((x, i) => true);
		map = map || ((x, i) => x);

		return new IFTSArrayPromise(this.db.indexes, new Promise((resolve, reject) => {
			const result = [];
			let index = 0;

			cursorRequest.onsuccess = ev => {
				const cursor = ev.target.result;
				if (cursor) {
					const value = cursor.value;
					if (this.db.primary_key === null) {
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
					result.push({ key: cursor.key, data: value });
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
  * return {IFTSArrayPromise}
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
	sort(column, order = 'asc', offset = 0, limit = undefined) {
		if (!this.db.indexes.has(column)) {
			return IFTSArrayPromise.reject(this.db.indexes, new NoSuchColumnError(column));
		}

		limit = limit === undefined ? undefined : offset + limit;
		const offsetFilter = (x, i) => offset <= i;

		const store = this.transaction.objectStore('data');

		if (column === this.db.primary_key) {
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
  * Get candidates of search result.
  *
  * @ignore
  */
	_takeCandidatesBySingleColumn(column, queries) {
		const index = this.transaction.objectStore(this.db.index_prefix + 'ngram_' + column).index('token');
		const result = [];

		for (let q in queries) {
			if (queries[q].length === 0) {
				result.push(this._getAllWithKeys().filter(x => x.data[column].includes(q)).map(x => x.key).then(xs => ({ query: q, keys: xs })));
				continue;
			}

			const promises = new Array(queries[q].length);
			for (let i = 0; i < queries[q].length; i++) {
				promises[i] = this._readCursor(index.openCursor(queries[q][i]), null, data => data.key);
			}

			const candidate = Promise.all(promises).then(founds => {
				if (founds.length === 0) {
					return Promise.resolve([]);
				}

				founds = flatten(founds);

				const deduped = new Array(founds.length);
				let dedup_num = 0;
				const hit_count = {};
				for (let i = 0; i < founds.length; i++) {
					if (!(founds[i] in hit_count)) {
						hit_count[founds[i]] = 0;

						deduped[dedup_num] = founds[i];
						dedup_num++;
					}
					hit_count[founds[i]]++;
				}

				const candidates = new Array(dedup_num);
				let candidate_num = 0;
				for (let i = 0; i < dedup_num; i++) {
					if (hit_count[deduped[i]] >= queries[q].length) {
						candidates[candidate_num] = this.get(deduped[i]).then(data => ({ key: deduped[i], data: data }));
						candidate_num++;
					}
				}
				return Promise.all(candidates.slice(0, candidate_num));
			}).then(xs => ({ query: q, keys: xs.filter(x => x.data[column].includes(q)).map(x => x.key) }));

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

		for (let i = 0; i < candidates.length; i++) {
			for (let j = 0; j < candidates[i].keys.length; j++) {
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

		for (let i = 0; i < columns.length; i++) {
			if (!this.db.ngram_indexes.has(columns[i])) {
				return IFTSArrayPromise.reject(this.db.indexes, new NoSuchColumnError(columns[i]));
			}
		}

		const queries = splitQuery(query);
		let queries_length = 0;

		for (let q in queries) {
			queries[q] = fastMap(queries[q], x => this._KeyRange.only(x));
			queries_length++;
		}

		const candidatePromises = [];

		for (let i = 0; i < columns.length; i++) {
			Array.prototype.push.apply(candidatePromises, this._takeCandidatesBySingleColumn(columns[i], queries));
		}

		return new IFTSArrayPromise(this.db.indexes, Promise.all(candidatePromises).then(xs => this._pruneCandidates(queries_length, xs)));
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

		for (let i = 0; i < columns.length; i++) {
			if (!this.db.word_indexes.has(columns[i])) {
				return IFTSArrayPromise.reject(this.db.indexes, new NoSuchColumnError(columns[i]));
			}
		}

		const queries = splitWords(query).map(x => ({ text: x, keyRange: this._KeyRange.only(x) }));

		return new IFTSArrayPromise(this.db.indexes, Promise.all(flatten(columns.map(col => {
			const index = this.transaction.objectStore(this.db.index_prefix + 'word_' + col).index('word');

			return queries.map(query => this._readCursor(index.openCursor(query.keyRange), null, data => [data.key, query.text]));
		}))).then(candidates => {
			candidates = dedup(flatten(candidates));

			const counts = {};
			for (let i = 0; i < candidates.length; i++) {
				const key = candidates[i][0];
				if (!(key in counts)) {
					counts[key] = 0;
				}
				counts[key]++;
			}

			const hits = new Array(candidates.length);
			let hits_count = 0;
			for (let i = 0; i < candidates.length; i++) {
				const key = candidates[i][0];
				if (counts[key] >= queries.length) {
					hits[hits_count] = key;
					hits_count++;
				}
			}

			const result = new Array(hits_count);
			for (let i = 0; i < hits_count; i++) {
				result[i] = this.get(hits[i]);
			}
			return new IFTSArrayPromise(this.db.indexes, Promise.all(result));
		}));
	}
}

/**
 * The database of IndexedFTS.
 *
 * Almost methods are the same interface as {@link IDBTransaction} and {@link IFTSArrayPromise}.
 */
class IndexedFTS {
	/**
  * Create or open IndexedFTS.
  *
  * Database has name and schema's version.
  * The name is a name of the database in the storage.
  *
  * The schema is an object that key is column name and value is a definition of indexes. Schema can't change in same version database.
  * If you want change schema of database, please change version number.
  * Please be careful, all contents will remove when changing the version number.
  *
  * Index types are 'primary', 'unique', 'fulltext', 'ngram', 'word', or normal index.
  *
  * 'primary' is a primary key of the database. 'primary' can't set to multiple columns.
  *
  * 'unique' is columns that have a unique value in the database.
  *
  * If set 'ngram' IndexedFTS will make 2-gram index table for full-text search.
  * 'fulltext' is alias to 'ngram'.
  *
  * 'word' is word based index.
  * The word index will split text with whitespaces and store those.
  * Word index is faster than the 'ngram' index but can't find a partial match in the word.
  *
  * The normal index that not set optioned that not unique, not primary, and not indexed for full-text search. You can numeric search like {@link IndexedFTS#lower} {@link IndexedFTS#between} even if not set option.
  *
  * If you want to set some index types, please use object like `{unique: true, fulltext: true}`.
  *
  * @param {string} name - name of new (or open) database.
  * @param {number} version - schema's version of database.
  * @param {Array<string|object>} schema - database schema.
  * @param {object} [options] - other options.
  * @param {string} [options.index_prefix='indexedfts_'] - prefix of indexes for full-text search.
  * @param {object} [options.scope=window] - endpoints for IndexedDB API.
  */
	constructor(name, version, schema, options = {}) {
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
		this.store_option = { autoIncrement: true };

		/** @type {string|null} */
		this.primary_key = null;

		/** @type {Set<string>} */
		this.ngram_indexes = new Set();

		/** @type {Set<string>} */
		this.word_indexes = new Set();

		/** @type {Set<string>} */
		this.unique_indexes = new Set();

		/** @type {Set<string>} */
		this.normal_indexes = new Set();

		/** @type {IDBDatabase} */
		this.db = null;

		for (let x in schema) {
			if (schema[x] === 'primary' || schema[x].primary) {
				if ('keyPath' in this.store_option) {
					throw new Error('can not use multi primary key');
				}
				this.primary_key = x;
				this.store_option = { keyPath: x };
			} else if (schema[x] === 'unique' || schema[x].unique) {
				this.unique_indexes.add(x);
			} else {
				this.normal_indexes.add(x);
			}

			if (schema[x] === 'ngram' || schema[x].ngram || schema[x] === 'fulltext' || schema[x].fulltext) {
				this.ngram_indexes.add(x);
			}

			if (schema[x] === 'word' || schema[x].word) {
				this.word_indexes.add(x);
			}
		}
	}

	/**
  * Delete database.
  *
  * Must be close all IndexedFTS before delete database.
  *
  * @param {string} name - name of target database. this method will success even if no such database.
  * @param {object} [scope] - endpoints for IndexedDB API.
  *
  * @return {Promise<undefined>}
  */
	static delete(name, scope = null) {
		return new Promise((resolve, reject) => {
			const req = (scope || window).indexedDB.deleteDatabase(name);
			req.onsuccess = ev => resolve();
			req.onerror = ev => reject(ev);
		});
	}

	/** @type {Set<string>} */
	get indexes() {
		const r = new Set([...this.ngram_indexes, ...this.word_indexes, ...this.unique_indexes, ...this.normal_indexes]);
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

				this.unique_indexes.forEach(x => store.createIndex(x, x, { unique: true }));

				this.normal_indexes.forEach(x => store.createIndex(x, x, { unique: false }));

				this.ngram_indexes.forEach(column => {
					const fts_store = this.db.createObjectStore(this.index_prefix + 'ngram_' + column, { autoIncrement: true });
					fts_store.onerror = reject;
					fts_store.createIndex('key', 'key', { unique: false });
					fts_store.createIndex('token', 'token', { unique: false });
				});

				this.word_indexes.forEach(column => {
					const fts_store = this.db.createObjectStore(this.index_prefix + 'word_' + column, { autoIncrement: true });
					fts_store.onerror = reject;
					fts_store.createIndex('key', 'key', { unique: false });
					fts_store.createIndex('word', 'word', { unique: false });
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
	transaction(mode = 'readonly', target = null) {
		if (target === null) {
			const ngrams = [...this.ngram_indexes].map(x => this.index_prefix + 'ngram_' + x);
			const words = [...this.word_indexes].map(x => this.index_prefix + 'word_' + x);
			target = ngrams.concat(words).concat(['data']);
		}
		return new IFTSTransaction(this, this.db.transaction(target, mode));
	}

	/**
  * Put contents into database.
  *
  * @param {object} contents - contents for save. allowed multiple arguments.
  *
  * @return {Promise<IndexedFTS>} returns self for chain.
  */
	put(...contents) {
		return this.transaction('readwrite').put(...contents).then(() => this);
	}

	/**
  * Delete contents from database.
  *
  * @param {object} keys - key of contents.
  *
  * @return {Promise<IndexedFTS>} returns self for chain. Will reject with {@link InvalidKeyError} if keys included null or undefined.
  */
	delete(...keys) {
		return this.transaction('readwrite').delete(...keys).then(() => this);
	}

	/**
  * Get content by primary key.
  *
  * @param {object} key - the key of content.
  *
  * @return {Promise<object|undefined>} content. promise will reject with {@link InvalidKeyError} if keys included null or undefined. result value will be undefined if not found.
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
  * Do something process for each elements and returns {@link IFTSArrayPromise}.
  *
  * NOTE: This method doesn't fast. May better do filtering before doing map if need filtering.
  *
  * @param {function(content: object, index: Number): object} fun - function for processing element.
  *
  * @return {IFTSArrayPromise}
  */
	map(fun) {
		return this._getFiltered(x => x.map(fun));
	}

	/**
  * Filtering elements by function and returns {@link IFTSArrayPromise}.
  *
  * WARNING: This method won't use the index. Other methods(eg. {@link IFTSTransaction#equals or @link IFTSTransaction#lower} may faster than this.
  *
  * @param {function(content: object, index: Number): object} fun - function for filtering element.
  *
  * return {IFTSArrayPromise}
  */
	filter(fun) {
		return this._getFiltered(x => x.filter(fun));
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
	sort(column, order = 'asc', offset = 0, limit = undefined) {
		return this._getFiltered(x => x.sort(column, order, offset, limit));
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
		return this._getFiltered(x => x.equals(column, value));
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
		return this._getFiltered(x => x.lower(column, value));
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
		return this._getFiltered(x => x.greater(column, value));
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
		return this._getFiltered(x => x.lowerOrEquals(column, value));
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
		return this._getFiltered(x => x.greaterOrEquals(column, value));
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
		return this._getFiltered(x => x.between(column, lower, upper));
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
		return this.transaction().search(columns, query);
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
		return this.transaction().searchWord(columns, query);
	}
}

exports.IndexedFTS = IndexedFTS;
exports.IFTSTransaction = IFTSTransaction;
exports.IFTSArrayPromise = IFTSArrayPromise;
exports.NoSuchColumnError = NoSuchColumnError;
exports.InvalidKeyError = InvalidKeyError;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=indexedfts.js.map
