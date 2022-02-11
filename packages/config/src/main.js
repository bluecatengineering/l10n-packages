import {posix} from 'path';
import {createHash} from 'crypto';

import {lilconfigSync} from 'lilconfig';
import {parse} from 'yaml';

const {dirname, join, isAbsolute} = posix;

const loadYaml = (filepath, content) => parse(content);

const options = {
	loaders: {
		'.yaml': loadYaml,
		'.yml': loadYaml,
		noExt: loadYaml,
	},
	searchPlaces: [
		'package.json',
		'.bc-l10nrc',
		'.bc-l10nrc.json',
		'.bc-l10nrc.yml',
		'.bc-l10nrc.yaml',
		'.bc-l10nrc.js',
		'.bc-l10nrc.cjs',
		'bc-l10n.config.js',
		'bc-l10n.config.cjs',
	],
};

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

const makeAbsolutePath = (rootDir, path) => (isAbsolute(path) ? path : join(rootDir, path));

export default () => {
	const result = lilconfigSync('bc-l10n', options).search();
	if (!result?.config) {
		throw new Error('L10n configuration is missing, add "bc-l10n" object to package.json');
	}
	const {config, filepath} = result;
	if (!config.module) {
		throw new Error('The "module" configuration is missing');
	}
	if (!config.catalogPath) {
		throw new Error('The "catalogPath" configuration is missing');
	}
	if (!/{locale}/.test(config.catalogPath)) {
		throw new Error('The "catalogPath" must contain a "{locale}" token');
	}
	const rootDir = dirname(filepath);
	config.sourcePath = makeAbsolutePath(rootDir, config.sourcePath || 'src');
	config.module = makeAbsolutePath(rootDir, config.module);
	config.catalogPath = makeAbsolutePath(rootDir, config.catalogPath);
	config.buildKey = createKeyBuilder(config.hashLength);
	return config;
};
