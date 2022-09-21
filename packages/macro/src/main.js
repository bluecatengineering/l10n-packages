import {posix} from 'path';

import {createMacro} from 'babel-plugin-macros';
import {addDefault} from '@babel/helper-module-imports';
import loadConfig from '@bluecateng/l10n-config';
import {convertFunction, convertTemplate} from '@bluecateng/l10n-ast2icu';

const {dirname, relative} = posix;

const {buildKey, module} = loadConfig();

const isAncestor = (ancestor, path) =>
	ancestor !== path && path.parentPath && (ancestor === path.parentPath || isAncestor(ancestor, path.parentPath));

const buildContext = (localNames) => {
	let counter = 0;
	const namedArgs = new Set();
	const numArgs = [];
	const addNamedArg = (node) => (namedArgs.add(node.name), node.name);
	const addNumArg = (node) => (numArgs.push(node), counter++);
	return {localNames, addNamedArg, addNumArg, namedArgs, numArgs};
};

export default createMacro(({references, state, babel: {types: t}}) => {
	const localNames = Object.fromEntries(
		Object.entries(references)
			.filter(([, v]) => v.length)
			.map(([k, v]) => [v[0].node.name, k])
	);
	const allPaths = Object.values(references).flatMap((list) => list.map(({parentPath}) => parentPath));
	const roots = allPaths.filter((path) => !allPaths.some((p) => isAncestor(p, path)));

	let relativePath = relative(dirname(state.filename), module);
	if (relativePath[0] !== '.') {
		relativePath = `./${relativePath}`;
	}
	const l10nFunction = addDefault(state.file.path, relativePath, {nameHint: 'l10n', importPosition: 'after'});

	for (const path of roots) {
		const ctx = buildContext(localNames);
		const node = path.node;
		const string =
			node.type === 'TaggedTemplateExpression'
				? convertTemplate(node.quasi, ctx)
				: convertFunction(localNames[node.callee.name], node, ctx);

		const args = [];
		args.push(t.stringLiteral(buildKey(string)));

		const {namedArgs, numArgs} = ctx;
		if (namedArgs.size || numArgs.length) {
			const props = [];
			for (const name of namedArgs) {
				const id = t.identifier(name);
				props.push(t.objectProperty(id, id, false, true));
			}
			numArgs.forEach((node, index) => {
				props.push(t.objectProperty(t.numericLiteral(index), node));
			});
			args.push(t.objectExpression(props));
		}

		const newNode = t.callExpression(t.cloneDeep(l10nFunction), args);
		newNode.loc = node.loc;
		path.addComment('leading', '#__PURE__');
		if (process.env.NODE_ENV !== 'production') {
			path.addComment('trailing', `l10n: ${string}`);
		}
		path.replaceWith(newNode);
	}
});
