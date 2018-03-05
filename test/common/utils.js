import assert from 'power-assert';

import {splitText, tokenize, splitQuery, splitWords, dedup, fastMap, flatten} from '../../lib/utils';


describe('utils', function() {
	describe('splitText', function() {
		it('simple', function() {
			assert.deepStrictEqual(splitText('hello world'), ['he', 'el', 'll', 'lo', 'o ', ' w', 'wo', 'or', 'rl', 'ld']);
		});

		it('1gram', function() {
			assert.deepStrictEqual(splitText('hello world', 1), ['h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'l', 'd']);
		});

		it('3gram', function() {
			assert.deepStrictEqual(splitText('hello world', 3), ['hel', 'ell', 'llo', 'lo ', 'o w', ' wo', 'wor', 'orl', 'rld']);
		});

		it('short text', function() {
			assert.deepStrictEqual(splitText('hi', 3), []);
		});
	});

	describe('splitWords', function() {
		it('simple', function() {
			assert.deepStrictEqual(splitWords('hello world'), ['hello', 'world']);
			assert.deepStrictEqual(splitWords('hello\nworld\tthis is\rtest'), ['hello', 'world', 'this', 'is', 'test']);
		});

		it('empty', function() {
			assert.deepStrictEqual(splitWords(''), []);
		});
	});

	describe('tokenize', function() {
		it('simple', function() {
			assert.deepStrictEqual(tokenize('hello hello'), ['he', 'el', 'll', 'lo', 'o ', ' h']);
		});

		it('1gram', function() {
			assert.deepStrictEqual(tokenize('hello hello', 1), ['h', 'e', 'l', 'o', ' ']);
		});

		it('3gram', function() {
			assert.deepStrictEqual(tokenize('hello hello', 3), ['hel', 'ell', 'llo', 'lo ', 'o h', ' he']);
		});

		it('short text', function() {
			assert.deepStrictEqual(tokenize('hi', 3), []);
		});
	});

	/** @test {splitQuery} */
	describe('splitQuery', function() {
		it('simple', function() {
			assert.deepStrictEqual(splitQuery('helloworld'), {
				'helloworld': tokenize('helloworld'),
			});
		});

		it('with space', function() {
			assert.deepStrictEqual(splitQuery('hello world'), {
				'hello': tokenize('hello'),
				'world': tokenize('world'),
			});
		});

		it('with special character', function() {
			assert.deepStrictEqual(splitQuery('\r\nhello  world\tfoo\nbar  '), {
				'hello': tokenize('hello'),
				'world': tokenize('world'),
				'foo': tokenize('foo'),
				'bar': tokenize('bar'),
			});
		});

		it('short text', function() {
			assert.deepStrictEqual(splitQuery('hi this is test', 3), {
				'hi': [],
				'this': tokenize('this', 3),
				'is': [],
				'test': tokenize('test', 3),
			});
		});
	});

	/** @test {dedup} */
	describe('dedup', function() {
		it('simple', function() {
			assert.deepStrictEqual(dedup([1, 2, 3, 1, 2, 4, 0]), [1, 2, 3, 4, 0]);
			assert.deepStrictEqual(dedup(['b', 'c', 'b', 'a']), ['b', 'c', 'a']);
		});

		it('no duplicate', function() {
			assert.deepStrictEqual(dedup([1, 2, 3, 5, 7, 0]), [1, 2, 3, 5, 7, 0]);
			assert.deepStrictEqual(dedup(['b', 'c', 'f', 'a']), ['b', 'c', 'f', 'a']);
		});

		it('full duplicate', function() {
			assert.deepStrictEqual(dedup([42, 42, 42]), [42]);
			assert.deepStrictEqual(dedup(['a', 'a', 'a', 'a']), ['a']);
		});

		it('empty', function() {
			assert.deepStrictEqual(dedup([]), []);
			assert.deepStrictEqual(dedup([]), []);
		});
	});

	/** @test {fastMap} */
	describe('fastMap', function() {
		it('simple', function() {
			const v1 = [1, 2, 3];
			assert.deepStrictEqual(fastMap(v1, x => x * 2), v1.map(x => x * 2));

			const v2 = ['a', 'b', 'c'];
			assert.deepStrictEqual(fastMap(v2, x => x + x), v2.map(x => x + x));
		});

		it('empty', function() {
			assert.deepStrictEqual(fastMap([], x => x * 2), []);
		});
	});

	/** @test {flatten} */
	describe('flatten', function() {
		it('simple', function() {
			const v1 = [[1, 2], [3, 4], [], [5, 6]];
			assert.deepStrictEqual(flatten(v1), [1, 2, 3, 4, 5, 6]);

			const v2 = [['a', 1], ['b', 2], []];
			assert.deepStrictEqual(flatten(v2), ['a', 1, 'b', 2]);
		});

		it('empty', function() {
			assert.deepStrictEqual(flatten([[], []]), []);
			assert.deepStrictEqual(flatten([[]]), []);
			assert.deepStrictEqual(flatten([]), []);
		});
	});
});
