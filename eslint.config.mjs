import blueCatNode from '@bluecateng/eslint-config-node';

export default [
	blueCatNode,
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
		ignores: ['packages/*/dist/'],
	},
];
