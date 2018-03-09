import {InvalidSchemaError} from './errors';


/** @ignore */
function normalize(schema) {
	const allowedOptions = new Set(['primary', 'unique', 'ngram', 'fulltext', 'word']);

	const result = {};
	for (const col in schema) {
		result[col] = {};

		if (typeof schema[col] === 'object') {
			for (const opt in schema[col]) {
				if (!allowedOptions.has(opt)) {
					throw new InvalidSchemaError(opt + ' is unknown option', col);
				}
				result[col][opt] = schema[col][opt];
			}
		} else if (typeof schema[col] === 'string') {
			if (!allowedOptions.has(schema[col])) {
				throw new InvalidSchemaError(schema[col] + ' is unknown option', col);
			}
			result[col][schema[col]] = true;
		} else {
			throw new InvalidSchemaError((typeof schema[col]) + ' is invalid option type', col);
		}
	}
	return result;
}


/** @ignore */
function schemaCheck(schema) {
	let primaryKey = null;

	for (const col in schema) {
		if (schema[col].primary !== undefined) {
			if (typeof schema[col].primary !== 'boolean') {
				throw new InvalidSchemaError('"primary" option must be boolean', col);
			}
			if (schema[col].primary) {
				if (primaryKey !== null) {
					throw new InvalidSchemaError('can not use multiple primary key', [col, primaryKey]);
				}
				primaryKey = col;
			}
		}

		if (schema[col].unique !== undefined) {
			if (typeof schema[col].unique !== 'boolean') {
				throw new InvalidSchemaError('"unique" option must be boolean', col);
			}
		}

		if (schema[col].primary && schema[col].unique) {
			throw new InvalidSchemaError('can not enable both of "primary" option and "unique" option to same column', col);
		}

		if (schema[col].ngram !== undefined && schema[col].fulltext !== undefined) {
			throw new InvalidSchemaError('can not set both of "ngram" option and "fulltext" option to same column', col);
		}
		const fts = schema[col].ngram === undefined ? schema[col].fulltext : schema[col].ngram;
		const ftsFrom = schema[col].ngram === undefined ? 'fulltext' : 'ngram';
		if (fts !== undefined && typeof fts !== 'boolean') {
			throw new InvalidSchemaError(`"${ftsFrom}" option must be boolean`, col);
		}

		if (schema[col].word !== undefined && typeof schema[col].word !== 'boolean') {
			throw new InvalidSchemaError('"word" option must be boolean', col);
		}
	}
}


/**
 * The database schema of IndexedFTS.
 */
class IFTSSchema {
	/**
	 * Create IFTSSchema.
	 *
	 * @param {object} schema - please see same name param of {@link IndexedFTS#constructor}.
	 *
	 * @throws {InvalidSchemaError}
	 */
	constructor(schema) {
		/** @ignore */
		this._schema = normalize(schema);

		/** @ignore */
		this._storeOption = {autoIncrement: true};

		/**
		 * Primary key of this schema.
		 *
		 * This value will be null if not set primary key.
		 *
		 * @type {string|null}
		 */
		this.primaryKey = null;

		/**
		 * Column names that indexed with ngram for full-text search.
		 *
		 * @type {Set<string>}
		 */
		this.ngramIndexes = new Set();

		/**
		 * Column names that indexed with word for full-text search.
		 *
		 * @type {Set<string>}
		 */
		this.wordIndexes = new Set();

		/**
		 * Column names that unique indexed.
		 *
		 * @type {Set<string>}
		 */
		this.uniqueIndexes = new Set();

		/**
		 * Column names that normal indexed.
		 *
		 * @type {Set<string>}
		 */
		this.normalIndexes = new Set();

		for (let x in schema) {
			schemaCheck(this._schema);

			if (this._schema[x].primary) {
				this.primaryKey = x;
				this._storeOption = {keyPath: x};
			} else if (this._schema[x].unique) {
				this.uniqueIndexes.add(x);
			} else {
				this.normalIndexes.add(x);
			}

			if (this._schema[x].ngram || this._schema[x].fulltext) {
				this.ngramIndexes.add(x);
			}

			if (this._schema[x].word) {
				this.wordIndexes.add(x);
			}
		}
	}

	/**
	 * All column names that indexed in some way.
	 *
	 * @type {Set<string>}
	 */
	get indexes() {
		if (this.primaryKey) {
			return new Set([this.primaryKey, ...this.uniqueIndexes, ...this.normalIndexes]);
		} else {
			return new Set([...this.uniqueIndexes, ...this.normalIndexes]);
		}
	}
}


export {IFTSSchema as default, normalize, schemaCheck};
