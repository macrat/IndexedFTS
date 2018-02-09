import indexedDB from 'fake-indexeddb';
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';
const scope = {indexedDB, IDBKeyRange};

import IndexedFTS from './lib';


const fts = new IndexedFTS('test', 1, {
	name: 'primary',
	title: {unique: true, fulltext: true},
	text: 'fulltext',
	age: {},
}, {scope: scope});


fts.open()
	.then(db => db.put({
			name: 'hello',
			title: 'this is test',
			text: 'this is test text\nhello world\n',
			age: 10,
	}, {
			name: 'test',
			title: 'hello world!',
			text: 'これはテストです。\nhello hello\n',
			age: 15,
	}, {
			name: 'foobar',
			title: 'abc',
			text: 'def\nis this ghi!\n',
			age: 20,
	}))

	.then(db => db.getAll())
	.then(xs => {
		console.log('get all:')
		console.log(xs);
		console.log('-----');
	})

	.then(() => fts.get('test'))
	.then(x => {
		console.log('get "test":');
		console.log(x);
		console.log('-----');
	})

	.then(() => fts.search('text', 'hello'))
	.then(xs => {
		console.log('search "hello":')
		console.log(xs);
		console.log('-----');
	})

	.then(() => fts.search('text', 'テスト'))
	.then(xs => {
		console.log('search "テスト":')
		console.log(xs);
		console.log('-----');
	})

	.then(() => fts.search('text', 'this').lower('age', 18))
	.then(xs => {
		console.log('text include "this" and age is lower than 18:')
		console.log(xs);
		console.log('-----');
	})

	.catch(console.error);
