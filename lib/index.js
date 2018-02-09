function splitText(text, ngram=2) {
	const result = [];
	for (let i=0; i<text.length-ngram+1; i++) {
		result.push(text.slice(i, i+ngram));
	}
	return result;
}


function tokenize(text, ngram=2) {
	return new Set(splitText(text, ngram));
}


function splitQuery(query, ngram=2) {
	const result = {};
	query.split(/\s+/).filter(q => q.length > 0).forEach(q => result[q] = tokenize(q, ngram));
	return result;
}


class NoSuchColumnError {
	constructor(column) {
		this.column = column;
		this.message = `NoSuchColumnError(${this.column})`
	}

	toString() {
		return this.message;
	}
}


class IFTSArrayPromise {
	constructor(indexes, promise) {
		this.indexes = indexes;
		this.promise = promise;
	}

	static resolve(indexes, value=[]) {
		return new IFTSArrayPromise(indexes, Promise.resolve(value));
	}

	static reject(indexes, value=[]) {
		return new IFTSArrayPromise(indexes, Promise.reject(value));
	}

	then(fun) {
		return this.promise.then(fun);
	}

	catch(fun) {
		return this.promise.catch(fun);
	}

	map(fun) {
		return new IFTSArrayPromise(this.indexes, this.then(xs => xs.map(fun)));
	}

	filter(fun) {
		return new IFTSArrayPromise(this.indexes, this.then(xs => xs.filter(fun)));
	}

	_checkAndFilter(column, fun) {
		if (!this.indexes.has(column)) {
			return IFTSArrayPromise.reject(this.indexes, new NoSuchColumnError(column));
		}

		return this.filter(fun);
	}

	equals(column, value) {
		return this._checkAndFilter(column, x => x[column] === value);
	}

	lower(column, value) {
		return this._checkAndFilter(column, x => x[column] < value);
	}

	greater(column, value) {
		return this._checkAndFilter(column, x => x[column] > value);
	}

	lowerOrEquals(column, value) {
		return this._checkAndFilter(column, x => x[column] <= value);
	}

	greaterOrEquals(column, value) {
		return this._checkAndFilter(column, x => x[column] >= value);
	}

	between(column, lower, upper) {
		return this._checkAndFilter(column, x => lower <= x[column] && x[column] <= upper);
	}

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


class IFTSTransaction {
	constructor(db, transaction) {
		this.db = db;
		this.transaction = transaction;
		this._KeyRange = this.db.scope.IDBKeyRange;

		this.promise = new Promise((resolve, reject) => {
			this.transaction.oncomplete = () => resolve(this.db);
			this.transaction.onerror = err => reject(err);
		});

		this._cache = {};
	}

	put() {
		const store = this.transaction.objectStore('data');
		const fts_indexes = [...this.db.fulltext_indexes].map(column => ({name: column, store: this.transaction.objectStore(this.db.index_prefix + column)}));

		return Promise.all(Array.prototype.map.apply(arguments, [data => {
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
		}])).then(data => {
			data.forEach(kv => {
				this._cache[kv[0]] = kv[1];
			});
			return this;
		});
	}

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

	getAll() {
		return this._readCursor(this.transaction.objectStore('data').openCursor());
	}

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

	equals(column, value) {
		return this._getAllWithIndex(column, this._KeyRange.only(value));
	}

	lower(column, value) {
		return this._getAllWithIndex(column, this._KeyRange.upperBound(value, true));
	}

	greater(column, value) {
		return this._getAllWithIndex(column, this._KeyRange.lowerBound(value, true));
	}

	lowerOrEquals(column, value) {
		return this._getAllWithIndex(column, this._KeyRange.upperBound(value, false));
	}

	greaterOrEquals(column, value) {
		return this._getAllWithIndex(column, this._KeyRange.lowerBound(value, false));
	}

	between(column, lower, upper) {
		return this._getAllWithIndex(column, this._KeyRange.bound(lower, upper, false, false));
	}

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


export default class IndexedFTS {
	constructor(name, version, schema, options) {
		this.index_prefix = options.index_prefix || 'indexedfts_';
		this.scope = options.scope || window;

		this.name = name;
		this.version = version;
		this.schema = schema;

		this.store_option = {autoIncrement: true};
		this.primary_key = null;
		this.fulltext_indexes = new Set();
		this.unique_indexes = new Set();
		this.normal_indexes = new Set();

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

	get indexes() {
		const r = new Set([...this.fulltext_indexes, ...this.unique_indexes, ...this.normal_indexes]);
		if (this.primary_key !== null) {
			r.add(this.primary_key);
		}
		return r;
	}

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

	close() {
		this.db.close();
	}

	transaction(mode='readonly', target=null) {
		if (target === null) {
			target = [...this.fulltext_indexes].map(x => this.index_prefix + x).concat(['data']);
		}
		return new IFTSTransaction(this, this.db.transaction(target, mode));
	}

	put() {
		return this.transaction('readwrite').put(...arguments).then(() => this);
	}

	get(key) {
		return this.transaction('readonly', 'data').get(key);
	}

	_getFiltered(fun) {
		return fun(this.transaction('readonly', 'data'));
	}

	getAll() {
		return this._getFiltered(x => x.getAll());
	}

	equals(column, value) {
		return this._getFiltered(x => x.equals(column, value));
	}

	lower(column, value) {
		return this._getFiltered(x => x.lower(column, value));
	}

	greater(column, value) {
		return this._getFiltered(x => x.greater(column, value));
	}

	lowerOrEquals(column, value) {
		return this._getFiltered(x => x.lowerOrEquals(column, value));
	}

	greaterOrEquals(column, value) {
		return this._getFiltered(x => x.greaterOrEquals(column, value));
	}

	between(column, lower, upper) {
		return this._getFiltered(x => x.between(column, lower, upper));
	}

	search(columns, query) {
		return this.transaction().search(columns, query);
	}
}
