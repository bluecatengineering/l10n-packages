module.exports = {
	env: {
		test: {
			sourceMaps: 'both',
			presets: [['@babel/env', {targets: {node: 'current'}}]],
		},
	},
};
