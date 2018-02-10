IndexedFTS
==========

[![Build Status](https://travis-ci.org/macrat/indexedfts.svg?branch=master)](https://travis-ci.org/macrat/indexedfts)
[![Coverage Status](https://coveralls.io/repos/github/macrat/indexedfts/badge.svg?branch=master)](https://coveralls.io/github/macrat/indexedfts?branch=master)
[![license](https://img.shields.io/github/license/macrat/indexedfts.svg)](https://github.com/macrat/IndexedFTS/blob/master/LICENSE)
[![document](https://img.shields.io/badge/github%20pages-document-blue.svg)](https://macrat.github.io/IndexedFTS/)

Full-Text Search engine for web browser.

## usage
``` javascript
import IndexedFTS from 'indexedfts';


// make database
const db = IndexedFTS('database-name', 1, {
	userid: 'primary',                     // primary key will indexed but can not full-text search
	name: {unique: true, fulltext: true},  // unique index and can full-text search
	description: 'fulltext',               // full-text search
});


db.open()
	.then(() => {
		db.put({
			userid: 1,
			name: 'hello',
			description: 'this is test\n',
		}, {
			userid: 20,
			name: 'world',
			description: 'check check\nhello hello world!',
		});
	})

	.then(() => db.search(['name', 'description'], 'hel').lower('userid', 5))
	.then(result => {
		console.log(result.length);   // output: 1
		console.log(result[0].name);  // output: hello
	})
```
