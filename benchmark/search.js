import {Suite} from 'promise-bench';

import IndexedFTS from '../lib';


const data = [
	{text: 'hello world!\nthis is test\n'},
	{text: 'hello hello world\n'},
	{text: 'this is test data\nasd\n'},
	{text: 'this is test contents\n'},
	{text: '日本語のテスト\n'},
	{text: 'this is テスト'},
	{text: 'これはtest\n'},
	{text: 't'},
	{text: '\n'},
	{text: 'IndexedFTS'},
];


export default function(base) {
	return new Suite(Object.assign(base, {
		async before() {
			this.db = await (new IndexedFTS('test-text', 1, {text: 'fulltext'})).open();

			await this.db.put({text: 'xyzxテスト'});
		},
		async after() {
			return this.db.getAll().then(contents => {
				return this.db.delete(...contents.map(x => x._key));
			});
		},
	}))
	.add({
		name: 'IndexedFTS#put',
		number: 100,
		fun() {
			return this.db.put(...data);
		},
		async after(result) {
			console.log(String(result));
		},
	})
	.add({
		name: 'IndexedFTS#search "xyzx"',
		async fun() {
			await this.db.search('text', 'xyzx');
		},
	})
	.add({
		name: 'IFTSTransaction#search "xyzx"',
		async fun() {
			await this.db.transaction().search('text', 'xyzx');
		},
	})
	.add({
		name: 'IFTSArrayResult#search "xyzx"',
		async fun() {
			await this.db.getAll().search('text', 'xyzx');
		},
	})
	.add({
		name: 'IndexedFTS#search "xテスト"',
		async fun() {
			await this.db.search('text', 'xテスト');
		},
	})
	.add({
		name: 'IFTSTransaction#search "xテスト"',
		async fun() {
			await this.db.transaction().search('text', 'xテスト');
		},
	})
	.add({
		name: 'IFTSArrayResult#search "xテスト"',
		async fun() {
			await this.db.getAll().search('text', 'xテスト');
		},
	})
	.add({
		name: 'IndexedFTS#search "x"',
		async fun() {
			await this.db.search('text', 'x');
		},
	})
	.add({
		name: 'IFTSArrayResult#search "x"',
		async fun() {
			await this.db.getAll().search('text', 'x');
		},
	})
	.add({
		name: 'IFTSTransaction#search "x"',
		async fun() {
			await this.db.transaction().search('text', 'x');
		},
	})
	.add({
		name: 'IndexedFTS#search "日本語"',
		async fun() {
			await this.db.search('text', '日本語');
		},
	})
	.add({
		name: 'IFTSTransaction#search "日本語"',
		async fun() {
			await this.db.transaction().search('text', '日本語');
		},
	})
	.add({
		name: 'IFTSArrayResult#search "日本語"',
		async fun() {
			await this.db.getAll().search('text', '日本語');
		},
	})
	.add({
		name: 'IndexedFTS#search "asd"',
		async fun() {
			await this.db.search('text', 'asd');
		},
	})
	.add({
		name: 'IFTSTransaction#search "asd"',
		async fun() {
			await this.db.transaction().search('text', 'asd');
		},
	})
	.add({
		name: 'IFTSArrayResult#search "asd"',
		async fun() {
			await this.db.getAll().search('text', 'asd');
		},
	})
}
