const rollup = require('rollup');
const babel = require('rollup-plugin-babel');
const uglify = require('rollup-plugin-uglify');


Promise.all([
	rollup
		.rollup({
			input: 'lib/index.js',
			plugins: [babel({runtimeHelpers: true})],
		})
		.then(bundle => bundle.write({format: 'es', exports: 'named', sourcemap: true, file: 'dist/indexedfts.mjs'})),

	rollup
		.rollup({
			input: 'lib/browser_index.js',
			plugins: [babel({runtimeHelpers: true})],
		})
		.then(bundle => bundle.write({format: 'umd', exports: 'named', sourcemap: true, file: 'dist/indexedfts.js', name: 'IndexedFTS'})),

	rollup
		.rollup({
			input: 'lib/index.js',
			plugins: [babel({runtimeHelpers: true}), uglify()],
		})
		.then(bundle => bundle.write({format: 'es', exports: 'named', sourcemap: true, file: 'dist/indexedfts.min.mjs'})),

	rollup
		.rollup({
			input: 'lib/browser_index.js',
			plugins: [babel({runtimeHelpers: true}), uglify()],
		})
		.then(bundle => bundle.write({format: 'umd', exports: 'named', sourcemap: true, file: 'dist/indexedfts.min.js', name: 'IndexedFTS'})),
]).catch(console.error);
