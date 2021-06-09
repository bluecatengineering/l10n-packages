import PO from 'pofile';
import loadConfig from '@bluecat/l10n-config';

import convert from './convert';

export default (source, output) => {
	const {buildKey} = loadConfig();

	const po = PO.parse(source);
	const messages = {};
	for (const item of po.items) {
		const msgid = item.msgid;
		messages[buildKey(msgid)] = convert(item.msgstr[0] || msgid);
	}
	const language = po.headers.Language;
	if (!language) {
		throw new Error('Language header is missing');
	}
	return (output === 'es' ? 'export default ' : 'module.exports=') + JSON.stringify([language, messages]);
};
