import assert from 'power-assert';

import indexedDB from 'fake-indexeddb';
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';
const scope = {indexedDB, IDBKeyRange};

import IndexedFTS from '../../lib';

import apitest from '../common/apitest';
import readwritetest from '../common/readwritetest';


describe('IndexedFTS', function() {
	apitest(async function() {
		this.target = new IndexedFTS('test', 1, this.schema, {scope: scope});

		await this.target.open();
		await this.target.put(...this.values);
	});

	describe('constructor', function() {
		it('multiple primary key', function() {
			assert.throws(() => {
				new IndexedFTS('tea', 1, {
					hoge: 'primary',
					fuga: {primary: true, fulltext: true},
				}, {scope: scope});
			}, /can not use multi primary key/);
		});
	});

	it('close', async function() {
		assert.doesNotThrow(() => {
			this.target.getAll();
		});
		assert.doesNotThrow(() => {
			this.target.close();
		});
		assert.throws(() => {
			this.target.getAll();
		}, /InvalidStateError/);
	});

	it('delete database', async function() {
		let db = new IndexedFTS('test-for-delete', 1, this.schema, {scope: scope});
		await db.open();
		await db.put(...this.values);
		assert.deepStrictEqual(await db.getAll(), this.values);
		db.close();

		assert(await IndexedFTS.delete('test-for-delete', scope) === undefined);

		db = new IndexedFTS('test-for-delete', 1, this.schema, {scope: scope});
		await db.open();
		assert.deepStrictEqual(await db.getAll(), []);
		db.close();

		assert(await IndexedFTS.delete('test-for-delete', scope) === undefined);
	});

	readwritetest();
});
