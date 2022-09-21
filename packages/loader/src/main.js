import converter from '@bluecateng/l10n-icu2obj';

export default function (source) {
	try {
		return converter(source, 'es');
	} catch (e) {
		this.emitError(e);
		return '';
	}
}
