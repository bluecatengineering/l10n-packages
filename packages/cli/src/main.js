import {isAbsolute, join} from 'node:path/posix';

import loadConfig from '@bluecateng/l10n-config';

import parseJS from './parseJS';
import scanDir from './scanDir';
import updateLocale from './updateLocale';

const extensions = /\.jsx?$/;

export default (clean, locale, sources) => {
	const {hashLength, sourcePath, catalogPath, locales, buildKey} = loadConfig();
	const cwd = process.cwd();
	const addReferences = hashLength ? (item) => (item.references = [buildKey(item.msgid)]) : () => {};
	const strings = new Set();
	return (
		sources.length
			? Promise.all(
					sources
						.map((path) => (isAbsolute(path) ? path : join(cwd, path)))
						.filter((path) => path.startsWith(sourcePath) && extensions.test(path))
						.map((path) => parseJS(strings, path))
			  )
			: scanDir(strings, sourcePath, extensions)
	)
		.then(() =>
			locale
				? updateLocale(locale, catalogPath, strings, addReferences, clean)
				: Promise.all(
						(locales || ['en']).map((locale) => updateLocale(locale, catalogPath, strings, addReferences, clean, true))
				  )
		)
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
};
