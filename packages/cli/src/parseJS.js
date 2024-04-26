import {readFile} from 'node:fs/promises';

import parser from '@babel/parser';
import _traverse from '@babel/traverse';
import {convertFunction, convertTemplate, validateImport} from '@bluecateng/l10n-ast2icu';

// workaround for https://github.com/babel/babel/issues/13855
const traverse = _traverse.default;

const buildContext = (localNames) => {
	let counter = 0;
	const addNamedArg = (node) => node.name;
	const addNumArg = () => counter++;
	return {localNames, addNamedArg, addNumArg};
};

export default (strings, path) =>
	readFile(path, 'utf8').then(
		(text) => {
			try {
				const ast = parser.parse(text, {
					sourceFilename: path,
					sourceType: 'module',
					plugins: ['jsx', 'typescript', 'classProperties', 'doExpressions', 'throwExpressions'],
				});

				const localNames = {};
				traverse(ast, {
					ImportDeclaration(path) {
						const {source, specifiers} = path.node;
						if (source.value === '@bluecateng/l10n.macro') {
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
			} catch (error) {
				throw new Error(`Error parsing ${path}: ${error.message}`, {cause: error});
			}
		},
		(error) => {
			throw new Error(`Error reading ${path}: ${error.message}`, {cause: error});
		}
	);
