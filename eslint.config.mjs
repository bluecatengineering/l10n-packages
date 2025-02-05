import blueCatNode from '@bluecateng/eslint-config-node';

export default [
	blueCatNode,
	{
		rules: {
			'import/extensions': ['warn', 'never', {json: 'always'}],
		},
	},
	{
		ignores: ['packages/*/index.js', 'packages/cli/cli.js'],
	},
];
