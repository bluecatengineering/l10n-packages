import {terser} from 'rollup-plugin-terser';

import pkg from './package.json';

export default {
	input: './src/main',
	external: Object.keys(pkg.dependencies),
	output: {file: 'index.js', format: 'cjs', exports: 'default'},
	plugins: [terser()],
};
