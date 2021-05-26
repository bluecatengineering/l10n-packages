import {posix} from 'path';
import {createHash} from 'crypto';

import {cosmiconfigSync} from 'cosmiconfig';

const {dirname, join} = posix;

const createKeyBuilder = (hashLength) => {
	const hashes = new Map();
	return hashLength
		? (k) => {
				const hash = createHash('sha1').update(k).digest('hex').slice(0, hashLength);
				const old = hashes.get(hash);
				if (old && old !== k) {
					throw new Error('Duplicated hash, increase hash length');
				}
				hashes.set(hash, k);
				return hash;
		  }
		: (k) => k;
};

export default () => {
	const {config, filepath} = cosmiconfigSync('bc-l10n').search();
	if (!config) {
		throw new Error('L10n configuration is missing, add "bc-l10n" object to package.json');
	}
	if (!config.module) {
		throw new Error('The "module" configuration is missing');
	}
	if (!config.catalogPath) {
		throw new Error('The "catalogPath" configuration is missing');
	}
	const rootDir = dirname(filepath);
	config.module = join(rootDir, config.module);
	config.catalogPath = join(rootDir, config.catalogPath);
	config.buildKey = createKeyBuilder(config.hashLength);
	return config;
};
