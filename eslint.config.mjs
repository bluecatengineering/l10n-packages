import blueCatNode from '@bluecateng/eslint-config-node';
import tseslint from 'typescript-eslint';

export default [
	blueCatNode,
	...tseslint.configs.recommended.map((config) => ({...config, files: ['**/*.ts']})),
	{
		rules: {
			'import-x/extensions': ['warn', 'never', {json: 'always'}],
		},
	},
	{
		// run directly by node, without bundling
		files: ['packages/cli/install.js', 'packages/cli/scripts/*.js'],
		rules: {
			'import-x/extensions': ['warn', 'always'],
		},
	},
	{
		ignores: ['packages/*/dist/', 'target/', 'packages/swc-plugin/tests/'],
	},
];
