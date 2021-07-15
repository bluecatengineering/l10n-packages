import {promises} from 'fs';
import {posix} from 'path';

import PO from 'pofile';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import loadConfig from '@bluecat/l10n-config';
import {convertFunction, convertTemplate, validateImport} from '@bluecat/l10n-ast2icu';

const extensions = /\.jsx?$/;

const {opendir, readFile} = promises;
const {isAbsolute, join} = posix;

const collator = new Intl.Collator('en', {sensitivity: 'base'});

const buildContext = (localNames) => {
	let counter = 0;
	const addNamedArg = (node) => node.name;
	const addNumArg = () => counter++;
	return {localNames, addNamedArg, addNumArg};
};

const parseJS = (strings, path) =>
	readFile(path, 'utf8').then(
		(text) => {
			try {
				const ast = parser.parse(text, {
					sourceFilename: path,
					sourceType: 'module',
					plugins: ['jsx', 'classProperties', 'doExpressions', 'throwExpressions'],
				});

				const localNames = {};
				traverse(ast, {
					ImportDeclaration(path) {
						const {source, specifiers} = path.node;
						if (source.value === '@bluecat/l10n.macro') {
							specifiers.forEach(({imported, local}) => {
								validateImport(imported);
								localNames[local.name] = imported.name;
							});
						}
					},

					TaggedTemplateExpression(path) {
						const {tag, quasi} = path.node;
						if (localNames[tag.name] === 't') {
							path.skip();
							strings.add(convertTemplate(quasi, buildContext(localNames)));
						}
					},

					CallExpression(path) {
						const {
							callee: {type, name},
						} = path.node;
						if (type === 'Identifier') {
							const macroName = localNames[name];
							if (macroName) {
								path.skip();
								strings.add(convertFunction(macroName, path.node, buildContext(localNames)));
							}
						}
					},
				});
			} catch (e) {
				throw new Error(`Error parsing ${path}: ${e.message}`);
			}
		},
		(error) => {
			throw new Error(`Error reading ${path}: ${error.message}`);
		}
	);

const scanDir = (strings, basePath) =>
	opendir(basePath).then((dir) => {
		const process = (entry) => {
			if (!entry) {
				return dir.close();
			}

			const name = entry.name;
			return (
				entry.isDirectory()
					? scanDir(strings, `${basePath}/${name}`)
					: entry.isFile() && extensions.test(name)
					? parseJS(strings, `${basePath}/${name}`)
					: Promise.resolve()
			)
				.then(() => dir.read())
				.then(process);
		};

		return dir.read().then(process);
	});

const updateLocale = (clean, locale, strings, catalogPath, addReferences, markObsolete) =>
	new Promise((resolve, reject) => {
		const fileName = `${catalogPath.replace(/{locale}/, locale)}.po`;
		PO.load(fileName, (err, po) => {
			if (err && err.code !== 'ENOENT') {
				return reject(new Error(`Error loading ${fileName}: ${err.message}`));
			}

			let changed = false;

			if (!po) {
				po = new PO();
				po.headers = {
					'POT-Creation-Date': new Date().toISOString(),
					'Mime-Version': '1.0',
					'Content-Type': 'text/plain; charset=utf-8',
					'Content-Transfer-Encoding': '8bit',
					'X-Generator': '@bluecat/l10n-cli',
					Language: locale,
				};
			} else {
				let needsCleaning;
				for (const item of po.items) {
					const msgid = item.msgid;
					if (strings.has(msgid)) {
						strings.delete(msgid);
						if (item.obsolete) {
							item.obsolete = false;
							changed = true;
						}
					} else if (markObsolete) {
						item.obsolete = true;
						changed = true;
					}
					if (item.obsolete) {
						needsCleaning = true;
					}
				}
				if (clean && needsCleaning) {
					changed = true;
					po.items = po.items.filter(({obsolete}) => !obsolete);
				}
			}

			const items = po.items || [];
			if (strings.size) {
				for (const msgid of strings) {
					const item = new PO.Item();
					item.msgid = msgid;
					addReferences(item);
					items.push(item);
				}
				changed = true;
			}

			if (changed) {
				po.items = items.sort((a, b) => collator.compare(a.msgid, b.msgid));
				return po.save(fileName, (err) => {
					if (err) {
						return reject(new Error(`Error saving ${fileName}: ${err.message}`));
					}
					return resolve();
				});
			}

			return resolve();
		});
	});

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
			: scanDir(strings, sourcePath)
	)
		.then(() =>
			locale
				? updateLocale(clean, locale, strings, catalogPath, addReferences)
				: Promise.all(
						(locales || ['en']).map((locale) => updateLocale(clean, locale, strings, catalogPath, addReferences, true))
				  )
		)
		.catch((error) => {
			console.error(error.message);
			process.exit(1);
		});
};
