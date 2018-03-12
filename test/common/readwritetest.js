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
			assert(await this.target.get(-1) === undefined);
			assert(await this.target.get(this.values.length) === undefined);
			assert(await this.target.get('hello') === undefined);
		});

		it('invalid key', async function() {
			assert(await this.target.get(null).catch(err => err.toString()) === 'invalid key');
			assert(await this.target.get(null).catch(err => err.key) === null);

			assert(await this.target.get(undefined).catch(err => err.toString()) === 'invalid key');
			assert(await this.target.get(undefined).catch(err => err.key) === undefined);
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
				[this.values[1], this.values[3]],
			);
			assert(await this.target.get(0) === undefined);
			assert(await this.target.get(2) === undefined);
			assert.deepStrictEqual(await this.target.search('title', 'hello world'), []);
			assert.deepStrictEqual(await this.target.search('text', 'こんにちは'), []);
		});

		it('not found', async function() {
			await this.target.delete(-1).catch(err => assert(err === undefined));
			await this.target.delete(this.values.length).catch(err => assert(err === undefined));

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

	describe('read indexes', function() {
		describe('getNGrams', function() {
			it('case sensitive', async function() {
				const tokens = [
					...new Set(['he', 'el', 'll', 'lo', 'o ', ' w', 'wo', 'or', 'rl', 'ld']),
					...new Set(['te', 'es', 'st', 't ', ' c', 'co', 'on', 'nt', 'te', 'en', 'nt']),
					...new Set(['ja', 'ap', 'pa', 'an', 'ne', 'es', 'se', 'e ', ' d', 'da', 'at', 'ta', 'a ', ' 日', '日本', '本語']),
					...new Set(['He', 'el', 'll', 'lo', 'o ', ' W', 'Wo', 'or', 'rl', 'ld']),
				];
				const except = new Map(tokens.map(x => [x, tokens.filter(y => x === y).length]));

				assert.deepStrictEqual(
					[...await this.target.getNGrams('title')].sort(),
					[...except].sort(),
				);

				assert.deepStrictEqual(
					[...await this.target.getNGrams('title', {ignoreCase: false})].sort(),
					[...except].sort(),
				);
			});

			it('ignore case', async function() {
				const tokens = [
					...new Set(['he', 'el', 'll', 'lo', 'o ', ' w', 'wo', 'or', 'rl', 'ld']),
					...new Set(['te', 'es', 'st', 't ', ' c', 'co', 'on', 'nt', 'te', 'en', 'nt']),
					...new Set(['ja', 'ap', 'pa', 'an', 'ne', 'es', 'se', 'e ', ' d', 'da', 'at', 'ta', 'a ', ' 日', '日本', '本語']),
					...new Set(['he', 'el', 'll', 'lo', 'o ', ' w', 'wo', 'or', 'rl', 'ld']),
				];
				const except = new Map(tokens.map(x => [x, tokens.filter(y => x === y).length]));

				assert.deepStrictEqual(
					[...await this.target.getNGrams('title', {ignoreCase: true})].sort(),
					[...except].sort(),
				);
			});

			it('not indexed', async function() {
				const err = await this.target.getNGrams('id')
					.then(x => 'not causes error')
					.catch(err => err);

				assert(err.toString() === 'id: no such column or no indexed');
				assert(err.column === 'id');
			});
		});

		describe('getWords', function() {
			it('case sensitive', async function() {
				const tokens = [
					'hello', 'world',
					'test', 'content',
					'japanese', 'data', '日本語',
					'Hello', 'World',
				];
				const except = new Map(tokens.map(x => [x, tokens.filter(y => x === y).length]));

				assert.deepStrictEqual(
					[...await this.target.getWords('title')].sort(),
					[...except].sort(),
				);

				assert.deepStrictEqual(
					[...await this.target.getWords('title', {ignoreCase: false})].sort(),
					[...except].sort(),
				);
			});

			it('ignore case', async function() {
				const tokens = [
					'hello', 'world',
					'test', 'content',
					'japanese', 'data', '日本語',
					'hello', 'world',
				];
				const except = new Map(tokens.map(x => [x, tokens.filter(y => x === y).length]));

				assert.deepStrictEqual(
					[...await this.target.getWords('title', {ignoreCase: true})].sort(),
					[...except].sort(),
				);
			});

			it('not indexed', async function() {
				const err = await this.target.getWords('age')
					.then(x => 'not causes error')
					.catch(err => err);

				assert(err.toString() === 'age: no such column or no indexed');
				assert(err.column === 'age');
			});
		});
	});
}
