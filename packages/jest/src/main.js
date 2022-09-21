import converter from '@bluecateng/l10n-icu2obj';

export default {
	process(source) {
		return {code: converter(source, 'node')};
	},
};
