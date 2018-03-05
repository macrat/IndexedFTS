import {splitQuery} from './utils';
import {NoSuchColumnError} from './errors';


/**
 * Promise like object for contents array.
 *
 * Almost methods are the same interface as {@link IndexedFTS} and {@link IFTSTransaction}.
 * But this class will processing all contents without using indexes.
 * Please consider using {@link IFTSTransaction} directly if it can.
 */
export default class IFTSArrayPromise {
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
	sort(column, order='asc', offset=0, limit=undefined) {
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
	 * This method can search even if didn't made fulltext index.
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
}
