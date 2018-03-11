import assert from 'power-assert';

import IFTSSchema, {normalize} from '../../lib/Schema';


describe('IFTSSchema', function() {
	describe('normalize', function() {
		it('string option', function() {
			const normalized = normalize({
				primary: 'primary',
				unique: 'unique',
				ngram: 'ngram',
				fulltext: 'fulltext',
				word: 'word',
			});

			assert.deepStrictEqual(normalized['primary'], {primary: true});
			assert.deepStrictEqual(normalized['unique'], {unique: true});
			assert.deepStrictEqual(normalized['ngram'], {ngram: true});
			assert.deepStrictEqual(normalized['fulltext'], {fulltext: true});
			assert.deepStrictEqual(normalized['word'], {word: true});
		});

		it('object option', function() {
			const normalized = normalize({
				priFull: {primary: true, fulltext: true},
				uniGram: {unique: true, ngram: true},
				fullWord: {fulltext: true, word: true},
			});

			assert.deepStrictEqual(normalized['priFull'], {primary: true, fulltext: true});
			assert.deepStrictEqual(normalized['uniGram'], {unique: true, ngram: true});
			assert.deepStrictEqual(normalized['fullWord'], {fulltext: true, word: true});
		});

		it('unknown string option', function() {
			assert.throws(() => {
				new IFTSSchema({
					foo: 'bar',
				});
			}, err => {
				assert(err.toString() === 'InvalidSchemaError: bar is unknown option');
				assert.deepStrictEqual(err.column, 'foo');

				return err.name === 'InvalidSchemaError';
			});
		});

		it('unknown object option', function() {
			assert.throws(() => {
				new IFTSSchema({
					fizz: {buzz: true},
				});
			}, err => {
				assert(err.toString() === 'InvalidSchemaError: buzz is unknown option');
				assert.deepStrictEqual(err.column, 'fizz');

				return err.name === 'InvalidSchemaError';
			});
		});

		it('invalid type option', function() {
			assert.throws(() => {
				new IFTSSchema({
					hoge: 42,
				});
			}, err => {
				assert(err.toString() === 'InvalidSchemaError: number is invalid option type');
				assert.deepStrictEqual(err.column, 'hoge');

				return err.name === 'InvalidSchemaError';
			});
		});
	});

	describe('constructor', function() {
		it('simple', function() {
			const schema = new IFTSSchema({
				id: 'primary',
				name: {unique: true, primary: false},
				profile: {ngram: true, word: false},
				message: 'fulltext',
				tags: 'word',
			});

			assert(schema.primaryKey === 'id');
			assert.deepStrictEqual([...schema.uniqueIndexes], ['name']);
			assert.deepStrictEqual([...schema.normalIndexes], ['profile', 'message', 'tags']);
			assert.deepStrictEqual([...schema.ngramIndexes], ['profile', 'message']);
			assert.deepStrictEqual([...schema.wordIndexes], ['tags']);
		});

		it('with primary key', function() {
			const schema = new IFTSSchema({foo: {primary: true}});
			assert(schema.primaryKey === 'foo');
		});

		it('without primary key', function() {
			const schema = new IFTSSchema({foo: {primary: false}});
			assert(schema.primaryKey === null);
		});

		describe('errors', function() {
			it('multiple primary key', function() {
				assert.throws(() => {
					new IFTSSchema({
						id: 'primary',
						name: {primary: true},
					});
				}, err => {
					assert(err.toString() === 'InvalidSchemaError: can not use multiple primary key');
					assert.deepStrictEqual(err.column, ['name', 'id']);

					return err.name === 'InvalidSchemaError';
				});
			});

			it('primary is not boolean', function() {
				assert.throws(() => {
					new IFTSSchema({
						id: {primary: 42},
					});
				}, err => {
					assert(err.toString() === 'InvalidSchemaError: "primary" option must be boolean');
					assert(err.column === 'id');

					return err.name === 'InvalidSchemaError';
				});
			});

			it('unique is not boolean', function() {
				assert.throws(() => {
					new IFTSSchema({
						name: {unique: 'hello'},
					});
				}, err => {
					assert(err.toString() === 'InvalidSchemaError: "unique" option must be boolean');
					assert(err.column === 'name');

					return err.name === 'InvalidSchemaError';
				});
			});

			it('enabled both of primary and unique', function() {
				assert.throws(() => {
					new IFTSSchema({
						id: {primary: true, unique: true},
					});
				}, err => {
					assert(err.toString() === 'InvalidSchemaError: can not enable both of "primary" option and "unique" option to same column');
					assert(err.column === 'id');

					return err.name === 'InvalidSchemaError';
				});
			});

			it('set both of ngram and fulltext', function() {
				assert.throws(() => {
					new IFTSSchema({
						profile: {ngram: true, fulltext: false},
					});
				}, err => {
					assert(err.toString() === 'InvalidSchemaError: can not set both of "ngram" option and "fulltext" option to same column');
					assert(err.column === 'profile');

					return err.name === 'InvalidSchemaError';
				});
			});

			it('ngram is not boolean', function() {
				assert.throws(() => {
					new IFTSSchema({
						profile: {ngram: /a/},
					});
				}, err => {
					assert(err.toString() === 'InvalidSchemaError: "ngram" option must be boolean');
					assert(err.column === 'profile');

					return err.name === 'InvalidSchemaError';
				});
			});

			it('fulltext is not boolean', function() {
				assert.throws(() => {
					new IFTSSchema({
						message: {fulltext: 123},
					});
				}, err => {
					assert(err.toString() === 'InvalidSchemaError: "fulltext" option must be boolean');
					assert(err.column === 'message');

					return err.name === 'InvalidSchemaError';
				});
			});

			it('word is not boolean', function() {
				assert.throws(() => {
					new IFTSSchema({
						tags: {word: 'foobar'},
					});
				}, err => {
					assert(err.toString() === 'InvalidSchemaError: "word" option must be boolean');
					assert(err.column === 'tags');

					return err.name === 'InvalidSchemaError';
				});
			});
		});
	});

	describe('indexes', function() {
		it('with primary key', function() {
			const schema = new IFTSSchema({
				id: 'primary',
				name: {unique: true, primary: false},
				profile: {ngram: true, word: false},
				message: 'fulltext',
				tags: 'word',
			});

			assert(schema.primaryKey === 'id');
			assert.deepStrictEqual([...schema.indexes], ['id', 'name', 'profile', 'message', 'tags']);
		});

		it('without primary key', function() {
			const schema = new IFTSSchema({
				id: 'unique',
				name: {unique: true, primary: false},
				profile: {ngram: true, word: false},
				message: 'fulltext',
				tags: 'word',
			});

			assert(schema.primaryKey === null);
			assert.deepStrictEqual([...schema.indexes], ['id', 'name', 'profile', 'message', 'tags']);
		});
	});

	describe('_storeOption', function() {
		it('with primary key', function() {
			const schema = new IFTSSchema({
				id: 'primary',
			});

			assert(schema.primaryKey === 'id');
			assert.deepStrictEqual(schema._storeOption, {keyPath: 'id'});
		});

		it('without primary key', function() {
			const schema = new IFTSSchema({
				id: 'unique',
			});

			assert(schema.primaryKey === null);
			assert.deepStrictEqual(schema._storeOption, {autoIncrement: true});
		});
	});
});
