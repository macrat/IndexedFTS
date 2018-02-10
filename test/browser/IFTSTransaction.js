import assert from 'power-assert';

import IndexedFTS from '../../lib';

import apitest from '../common/apitest';
import readwritetest from '../common/readwritetest';


describe('IFTSTransaction', function() {
	apitest(async function() {
		this.db = new IndexedFTS('test', 1, this.schema);

		await this.db.open();
		await this.db.put(...this.values);
	});

	before(function() {
		Object.defineProperty(this, 'target', {
			get() { return this.db.transaction('readwrite'); }
		});
	});

	readwritetest();
});
