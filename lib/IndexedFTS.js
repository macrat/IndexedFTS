import IFTSTransaction from './IFTSTransaction';


/**
 * The database of IndexedFTS.
 *
 * Almost methods are the same interface as {@link IDBTransaction} and {@link IFTSArrayPromise}.
 */
export default class IndexedFTS {
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
	 * Index types are 'primary', 'unique', 'fulltext', or not indexed.
	 *
	 * 'primary' is a primary key of the database. 'primary' can't set to multiple columns.
	 * 'unique' is columns that have a unique value in the database.
	 * If set 'fulltext' IndexedFTS will make index table for full-text search.
	 * Not indexed columns will store to the database but can't search.
	 *
	 * If you want to set some index types, please use object like `{unique: true, fulltext: true}`.
	 *
	 * @param {string} name - name of new (or open) database.
	 * @param {number} version - schema's version of database.
	 * @param {Array<string|object>} schema - database schema.
	 * @param {object} options - other options.
	 * @param {string} options.index_prefix - prefix of indexes for full-text search.
	 * @param {object} options.scope - endpoints for IndexedDB API.
	 */
	constructor(name, version, schema, options={}) {
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
					throw new Error('can not use multi primary key');
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

				this.unique_indexes.forEach(x => store.createIndex(x, x, {unique: true}));

				this.normal_indexes.forEach(x => store.createIndex(x, x, {unique: false}));

				this.fulltext_indexes.forEach(column => {
					const fts_store = this.db.createObjectStore(this.index_prefix + column, {autoIncrement: true});
					fts_store.onerror = reject
					fts_store.createIndex('key', 'key', {unique: false});
					fts_store.createIndex('token', 'token', {unique: false});
					fts_store.createIndex('uni', ['key', 'token'], {unique: true});
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
	 * @param {function(content: object): object} fun - function for processing element.
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
	 * @param {function(content: object): object} fun - function for filtering element.
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
	sort(column, order='asc', offset=0, limit=undefined) {
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
	 * This method can search even if didn't made fulltext index.
	 *
	 * WARNING: This method always processes all contents without using indexes.
	 * Please consider using {@link IFTSTransaction#search}.
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
}
