import {opendirSync, readFileSync} from 'fs';

import PO from 'pofile';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import loadConfig from '@bluecat/l10n-config';
import {convertFunction, convertTemplate, validateImport} from '@bluecat/l10n-ast2icu';

const extensions = /\.jsx?$/;

const collator = new Intl.Collator('en', {sensitivity: 'base'});

const buildContext = (localNames) => {
	let counter = 0;
	const addNamedArg = (node) => node.name;
	const addNumArg = () => counter++;
	return {localNames, addNamedArg, addNumArg};
};

const parseJS = (strings, path) => {
	try {
		const ast = parser.parse(readFileSync(path, 'utf8'), {
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
		console.error(`Error parsing ${path}: ${e.message}`);
		process.exit(1);
	}
};

const scanDir = (strings, basePath) => {
	const dir = opendirSync(basePath);
	let entry;
	while ((entry = dir.readSync())) {
		const name = entry.name;
		if (entry.isDirectory()) {
			scanDir(strings, `${basePath}/${name}`);
		} else if (entry.isFile() && extensions.test(name)) {
			parseJS(strings, `${basePath}/${name}`);
		}
	}
	dir.closeSync();
};

function updateLocale(locale, strings, catalogPath, addReferences, markObsolete) {
	const fileName = `${catalogPath.replace(/{locale}/, locale)}.po`;
	PO.load(fileName, (err, po) => {
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
			po.save(fileName, (err) => {
				if (err) {
					console.error(`Error saving ${fileName}: ${err.message}`);
					process.exit(1);
				}
			});
		}
	});
}

export default (locale, sources) => {
	const {hashLength, catalogPath, locales, buildKey} = loadConfig();
	const addReferences = hashLength ? (item) => (item.references = [buildKey(item.msgid)]) : () => {};
	const strings = new Set();
	if (sources.length) {
		for (const path of sources) {
			if (extensions.test(path)) {
				parseJS(strings, path);
			}
		}
	} else {
		scanDir(strings, 'src');
	}

	if (locale) {
		updateLocale(locale, strings, catalogPath, addReferences);
	} else {
		for (const locale of locales || ['en']) {
			updateLocale(locale, strings, catalogPath, addReferences, true);
		}
	}
};
