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
