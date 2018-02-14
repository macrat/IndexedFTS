import assert from 'power-assert';

import {splitText, tokenize, splitQuery} from '../../lib/utils';


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

	describe('tokenize', function() {
		it('simple', function() {
			assert.deepStrictEqual(tokenize('hello hello'), new Set(['he', 'el', 'll', 'lo', 'o ', ' h']));
		});

		it('1gram', function() {
			assert.deepStrictEqual(tokenize('hello hello', 1), new Set(['h', 'e', 'l', 'o', ' ']));
		});

		it('3gram', function() {
			assert.deepStrictEqual(tokenize('hello hello', 3), new Set(['hel', 'ell', 'llo', 'lo ', 'o h', ' he']));
		});

		it('short text', function() {
			assert.deepStrictEqual(tokenize('hi', 3), new Set());
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
				'hi': new Set(),
				'this': tokenize('this', 3),
				'is': new Set(),
				'test': tokenize('test', 3),
			});
		});
	});
});
