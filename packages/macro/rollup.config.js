import {nodeResolve} from '@rollup/plugin-node-resolve';
import {terser} from 'rollup-plugin-terser';

import pkg from './package.json';

export default {
	input: './src/main',
	external: [...Object.keys(pkg.peerDependencies), ...Object.keys(pkg.dependencies)],
	output: {file: 'index.js', format: 'cjs', exports: 'default'},
	plugins: [nodeResolve(), terser()],
};
