import assert from 'power-assert';
import rewire from 'rewire';


const IndexedFTS = rewire('../lib');


describe('utils', function() {
	describe('splitText', function() {
		beforeEach(function() {
			this.splitText = IndexedFTS.__get__('splitText');
		});

		it('simple', function() {
			assert.deepStrictEqual(this.splitText('hello world'), ['he', 'el', 'll', 'lo', 'o ', ' w', 'wo', 'or', 'rl', 'ld']);
		});

		it('1gram', function() {
			assert.deepStrictEqual(this.splitText('hello world', 1), ['h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'l', 'd']);
		});

		it('3gram', function() {
			assert.deepStrictEqual(this.splitText('hello world', 3), ['hel', 'ell', 'llo', 'lo ', 'o w', ' wo', 'wor', 'orl', 'rld']);
		});

		it('short text', function() {
			assert.deepStrictEqual(this.splitText('hi', 3), []);
		});
	});

	describe('tokenize', function() {
		beforeEach(function() {
			this.tokenize = IndexedFTS.__get__('tokenize');
		});

		it('simple', function() {
			assert.deepStrictEqual(this.tokenize('hello hello'), new Set(['he', 'el', 'll', 'lo', 'o ', ' h']));
		});

		it('1gram', function() {
			assert.deepStrictEqual(this.tokenize('hello hello', 1), new Set(['h', 'e', 'l', 'o', ' ']));
		});

		it('3gram', function() {
			assert.deepStrictEqual(this.tokenize('hello hello', 3), new Set(['hel', 'ell', 'llo', 'lo ', 'o h', ' he']));
		});

		it('short text', function() {
			assert.deepStrictEqual(this.tokenize('hi', 3), new Set());
		});
	});

	/** @test {splitQuery} */
	describe('splitQuery', function() {
		beforeEach(function() {
			this.splitQuery = IndexedFTS.__get__('splitQuery');
			this.tokenize = IndexedFTS.__get__('tokenize');
		});

		it('simple', function() {
			assert.deepStrictEqual(this.splitQuery('helloworld'), {
				'helloworld': this.tokenize('helloworld'),
			});
		});

		it('with space', function() {
			assert.deepStrictEqual(this.splitQuery('hello world'), {
				'hello': this.tokenize('hello'),
				'world': this.tokenize('world'),
			});
		});

		it('with special character', function() {
			assert.deepStrictEqual(this.splitQuery('\r\nhello  world\tfoo\nbar  '), {
				'hello': this.tokenize('hello'),
				'world': this.tokenize('world'),
				'foo': this.tokenize('foo'),
				'bar': this.tokenize('bar'),
			});
		});

		it('short text', function() {
			assert.deepStrictEqual(this.splitQuery('hi this is test', 3), {
				'hi': new Set(),
				'this': this.tokenize('this', 3),
				'is': new Set(),
				'test': this.tokenize('test', 3),
			});
		});
	});
});
