import assert from 'power-assert';

import IndexedFTS, {IFTSSchema} from '../../lib';

import apitest from '../common/apitest';
import readwritetest from '../common/readwritetest';


describe('IndexedFTS', function() {
	apitest(async function() {
		this.target = new IndexedFTS('test', 1, this.schema);

		await this.target.open();
		await this.target.put(...this.values);
	});

	describe('constructor', function() {
		it('schema from object', function() {
			assert.deepStrictEqual(this.target.schema._schema, new IFTSSchema(this.schema)._schema);
		});

		it('schema from IFTSSchema', function() {
			const schema = new IFTSSchema(this.schema);

			assert.deepStrictEqual(
				(new IndexedFTS('hoge', 1, schema)).schema._schema,
				schema._schema,
			);
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
		let db = new IndexedFTS('test-for-delete', 1, this.schema);
		await db.open();
		await db.put(...this.values);
		assert.deepStrictEqual(await db.getAll(), this.values);
		db.close();

		assert(await IndexedFTS.delete('test-for-delete') === undefined);

		db = new IndexedFTS('test-for-delete', 1, this.schema);
		await db.open();
		assert.deepStrictEqual(await db.getAll(), []);
		db.close();

		assert(await IndexedFTS.delete('test-for-delete') === undefined);
	});

	readwritetest();
});
