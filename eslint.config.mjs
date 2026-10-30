import blueCatNode from '@bluecateng/eslint-config-node';
import tseslint from 'typescript-eslint';

export default [
	blueCatNode,
	...tseslint.configs.recommended.map((config) => ({...config, files: ['**/*.ts']})),
	{
		rules: {
			'import/extensions': ['warn', 'never', {json: 'always'}],
		},
	},
	{
		files: ['packages/cli/cli.js'],
		rules: {
			'import/extensions': ['warn', 'always'],
		},
	},
	{
		ignores: ['packages/*/dist/', 'packages/swc-plugin/target/', 'packages/swc-plugin/tests/'],
	},
];
