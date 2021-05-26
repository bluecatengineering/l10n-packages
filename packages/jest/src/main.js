import converter from '@bluecat/l10n-icu2obj';

export default {
	process(source) {
		return converter(source, 'node');
	},
};
