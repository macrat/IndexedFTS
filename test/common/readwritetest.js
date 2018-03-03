import assert from 'power-assert';

import {InvalidKeyError} from '../../lib';


export default function readwritetest() {
	it('getAll', async function() {
		assert.deepStrictEqual(
			await this.target.getAll(),
			this.values,
		);
	});

	describe('get', function() {
		it('single', async function() {
			assert.deepStrictEqual(
				await this.target.get(1),
				this.values[1],
			);
		});

		it('not found', async function() {
			assert(await this.target.get(3) === undefined);
			assert(await this.target.get('hello') === undefined);
		});

		it('invalid key', async function() {
			assert(await this.target.get(null).catch(err => err.toString()) === 'invalid key');
			assert(await this.target.get(null).catch(err => err.key) === null);

			assert(await this.target.get(undefined).catch(err => err.toString()) === 'invalid key');
			assert(await this.target.get(undefined).catch(err => err.key) === undefined);
		});

		it('all', async function() {
			assert.deepStrictEqual(
				await this.target.getAll(),
				this.values,
			);
		});
	});

	describe('delete', function() {
		it('simple', async function() {
			await this.target.delete(0);

			assert.deepStrictEqual(
				await this.target.getAll(),
				this.values.slice(1),
			);
			assert(await this.target.get(0) === undefined);
			assert.deepStrictEqual(await this.target.search('title', 'hello world'), []);
		});

		it('multi', async function() {
			await this.target.delete(2, 0);

			assert.deepStrictEqual(
				await this.target.getAll(),
				[this.values[1]],
			);
			assert(await this.target.get(0) === undefined);
			assert(await this.target.get(2) === undefined);
			assert.deepStrictEqual(await this.target.search('title', 'hello world'), []);
			assert.deepStrictEqual(await this.target.search('text', 'こんにちは'), []);
		});

		it('not found', async function() {
			await this.target.delete(-1).catch(err => assert(err === undefined));
			await this.target.delete(3).catch(err => assert(err === undefined));

			assert.deepStrictEqual(
				await this.target.getAll(),
				this.values,
			);
		});

		it('invalid key', async function() {
			assert(await this.target.delete(null).catch(err => err.toString()) === 'invalid key');
			assert(await this.target.delete(null).catch(err => err.key) === null);
			assert(await this.target.delete(undefined).catch(err => err.toString()) === 'invalid key');
			assert(await this.target.delete(undefined).catch(err => err.key) === undefined);

			assert(await this.target.delete(0, null).catch(err => err.toString()) === 'invalid key');
			assert(await this.target.delete(0, null).catch(err => err.key) === null);
			assert(await this.target.delete(null, 1).catch(err => err.toString()) === 'invalid key');
			assert(await this.target.delete(null, 1).catch(err => err.key) === null);
		});
	});
}
