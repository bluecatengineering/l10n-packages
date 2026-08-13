import {nodeResolve} from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

import pkg from './package.json' with {type: 'json'};

export default {
	input: './src/main',
	external: Object.keys(pkg.dependencies),
	output: {file: 'dist/index.js', format: 'es'},
	plugins: [nodeResolve(), terser()],
};
