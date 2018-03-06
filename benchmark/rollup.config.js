import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';


export default {
	input: 'index.js',
	output: {
		file: 'bundle.js',
		format: 'es',
		sourcemap: true,
	},
	plugins: [commonjs(), resolve()],
}
