/**
 * Splitting text to n-gram
 *
 * @ignore
 */
export function splitText(text, ngram=2) {
	const result = [];
	for (let i=0; i<text.length-ngram+1; i++) {
		result.push(text.slice(i, i+ngram));
	}
	return result;
}


/**
 * Make n-gram set by text.
 *
 * @ignore
 */
export function tokenize(text, ngram=2) {
	return dedup(splitText(text, ngram));
}


/**
 * Parse queries.
 *
 * @ignore
 */
export function splitQuery(query, ngram=2) {
	const result = {};
	query.split(/\s+/).filter(q => q.length > 0).forEach(q => result[q] = tokenize(q, ngram));
	return result;
}


/**
 * Deduplication from Array
 *
 * @ignore
 */
export function dedup(array) {
	const result = new Array(array.length);
	const index = new Set();
	let idx = 0;

	for (let i=0; i<array.length; i++) {
		if (!index.has(array[i])) {
			index.add(array[i]);
			result[idx] = array[i];
			idx++;
		}
	}

	return result.slice(0, idx);
}


/**
 * Faster Array.prototype.map
 *
 * @ignore
 */
export function fastMap(array, fun) {
	const result = new Array(array.length);
	for (let i=0; i<array.length; i++) {
		result[i] = fun(array[i]);
	}
	return result;
}


/**
 * Flatten nested array
 *
 * @ignore
 */
export function flatten(array) {
	let length = 0;
	for (let i=0; i<array.length; i++) {
		length += array[i].length;
	}

	const result = new Array(length);
	let idx = 0;
	for (let i=0; i<array.length; i++) {
		for (let j=0; j<array[i].length; j++) {
			result[idx] = array[i][j];
			idx++;
		}
	}

	return result;
}
