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
	return new Set(splitText(text, ngram));
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
