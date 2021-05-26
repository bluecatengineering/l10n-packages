import {terser} from 'rollup-plugin-terser';

export default {
	input: './src/main',
	output: {file: 'index.js', format: 'cjs'},
	plugins: [terser()],
};
