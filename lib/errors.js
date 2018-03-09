/**
 * NoSuchColumnError means specified no indexed column.
 */
export class NoSuchColumnError extends Error {
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
export class InvalidKeyError extends Error {
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
 * InvalidSchemaError means specified invalid schema.
 */
export class InvalidSchemaError extends Error {
	/**
	 * @param {string} reason - why throws this error.
	 * @param {string|string[]|null} column - name of column that invalid.
	 */
	constructor(reason, column=null) {
		super(reason);

		/**
		 * Name of column that invalid.
		 *
		 * @type {string|string[]|null}
		 */
		this.column = column;

		/** @ignore */
		this.name = 'InvalidSchemaError';

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, InvalidSchemaError);
		}
	}
}
