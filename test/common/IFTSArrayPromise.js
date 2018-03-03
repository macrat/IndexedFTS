import assert from 'power-assert';

import {IFTSArrayPromise} from '../../lib';

import apitest from './apitest';


describe('IFTSArrayPromise', function() {
	apitest(async function() {
		const indexes = new Set();
		for (let col in this.schema) {
			indexes.add(col);
		}

		this.target = IFTSArrayPromise.resolve(indexes, this.values);
	});

	it('static resolve', async function() {
		const xs = await this.target;
		assert.deepStrictEqual(xs, this.values);
	});

	it('catch', async function() {
		const err1 = await this.target.then(xs => Promise.reject('error test')).catch(err => err);
		assert(err1 === 'error test');

		const err2 = await (new IFTSArrayPromise(new Set(), Promise.reject('error test 2'))).catch(err => err);
		assert(err2 === 'error test 2');

		const err3 = await IFTSArrayPromise.reject(new Set(), 'error test 3').catch(err => err);
		assert(err3 === 'error test 3');
	});
});
