import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, relative} from 'node:path/posix';

import loadConfig from '@bluecateng/l10n-config';
import compile from '@bluecateng/l10n-icu2obj';

export default (outDir) => {
	const {sourcePath, catalogPath, locales} = loadConfig();
	return Promise.all(
		(locales || ['en']).map((locale) => {
			const catalogFile = catalogPath.replace(/{locale}/, locale);
			const outFile = `${join(outDir, relative(sourcePath, catalogFile))}.po.js`;
			return readFile(`${catalogFile}.po`, 'utf8')
				.then((source) => compile(source, 'es'))
				.then((code) => mkdir(dirname(outFile), {recursive: true}).then(() => writeFile(outFile, code)));
		})
	).catch((error) => {
		console.error(error);
		process.exit(1);
	});
};
