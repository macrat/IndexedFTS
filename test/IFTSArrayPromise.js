import assert from 'power-assert';
import rewire from 'rewire';

const IndexedFTS = rewire('../lib');

import apitest from './apitest';


describe('IFTSArrayPromise', function() {
	apitest(async function() {
		const indexes = new Set();
		for (let col in this.schema) {
			indexes.add(col);
		}

		this.IFTSArrayPromise = IndexedFTS.__get__('IFTSArrayPromise');
		this.target = this.IFTSArrayPromise.resolve(indexes, this.values);
	});

	it('static resolve', async function() {
		const xs = await this.target;
		assert.deepStrictEqual(xs, this.values);
	});

	it('catch', async function() {
		const err1 = await this.target.then(xs => Promise.reject('error test')).catch(err => err);
		assert(err1 === 'error test');

		const err2 = await (new this.IFTSArrayPromise(new Set(), Promise.reject('error test 2'))).catch(err => err);
		assert(err2 === 'error test 2');

		const err3 = await this.IFTSArrayPromise.reject(new Set(), 'error test 3').catch(err => err);
		assert(err3 === 'error test 3');
	});

	it('map', async function() {
		assert.deepStrictEqual(
			await this.target.map(x => x.title),
			this.values.map(x => x.title),
		);

		assert.deepStrictEqual(
			await this.target.map(x => x.id * 2),
			this.values.map(x => x.id * 2),
		);
	});

	describe('filter', function() {
		it('simple', async function() {
			assert.deepStrictEqual(
				await this.target.filter(x => x.id >= 1),
				this.values.filter(x => x.id >= 1),
			);

			assert.deepStrictEqual(
				await this.target.filter(x => x.title === 'test data'),
				this.values.filter(x => x.title === 'test data'),
			);
		});

		it('all', async function() {
			assert.deepStrictEqual(
				await this.target.filter(x => true),
				this.values,
			);
		});

		it('nothing', async function() {
			assert.deepStrictEqual(
				await this.target.filter(x => false),
				[],
			);
		});
	});
});
