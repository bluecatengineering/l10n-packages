import {nodeResolve} from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
	input: './src/main',
	output: {file: 'dist/index.js', format: 'es'},
	plugins: [nodeResolve(), terser()],
};
