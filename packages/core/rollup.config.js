import {nodeResolve} from '@rollup/plugin-node-resolve';
import {terser} from 'rollup-plugin-terser';

export default {
	input: './src/main',
	output: {file: 'index.js', exports: 'default'},
	plugins: [nodeResolve(), terser()],
};
