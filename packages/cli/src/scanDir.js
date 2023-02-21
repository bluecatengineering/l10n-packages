import {readdir} from 'node:fs/promises';

import parseJS from './parseJS';

const scanDir = (strings, basePath, extensions) =>
	readdir(basePath, {encoding: 'utf8', withFileTypes: true}).then((entries) =>
		Promise.all(
			entries.map((entry) => {
				const name = entry.name;
				return entry.isDirectory()
					? scanDir(strings, `${basePath}/${name}`, extensions)
					: entry.isFile() && extensions.test(name)
					? parseJS(strings, `${basePath}/${name}`)
					: Promise.resolve();
			})
		)
	);

export default scanDir;
