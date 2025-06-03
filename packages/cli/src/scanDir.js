import {readdir} from 'node:fs/promises';

import parseJS from './parseJS';

const scanDir = (strings, basePath, extensions) =>
	readdir(basePath, {encoding: 'utf8', withFileTypes: true, recursive: true}).then((entries) =>
		Promise.all(
			entries.map((entry) => {
				const name = entry.name;
				return entry.isFile() && extensions.test(name)
					? parseJS(strings, `${entry.parentPath}/${name}`)
					: Promise.resolve();
			})
		)
	);

export default scanDir;
