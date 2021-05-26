const nodeLocation = ({
	loc: {
		start: {line, column},
	},
}) => `(${line}:${column + 1})`;

const isIdentifier = (node, name) => node.type === 'Identifier' && (!name || node.name === name);

const functionHandlers = {
	t(node, ctx) {
		const args = node.arguments;
		if (args.length !== 1) {
			throw new Error(`This macro requires one argument ${nodeLocation(node)}`);
		}
		return convertExpression(args[0], ctx);
	},

	select(node, ctx) {
		return convertSelection(
			node,
			ctx,
			'select',
			() => {},
			({key, value}) => `${key.name || key.value} {${convertExpression(value, ctx)}}`
		);
	},

	plural(node, ctx) {
		return convertPlural(node, ctx, 'plural');
	},

	selectOrdinal(node, ctx) {
		return convertPlural(node, ctx, 'selectordinal');
	},

	number(node, ctx) {
		const args = node.arguments;
		const length = args.length;
		if (length === 0 || length > 2) {
			throw new Error(`This macro requires one or two arguments ${nodeLocation(node)}`);
		}
		if (length === 2 && args[1].type !== 'StringLiteral') {
			throw new Error(`The second argument must be a string literal ${nodeLocation(args[1])}`);
		}
		return length === 1
			? `{${convertArgument(args[0], ctx)}, number}`
			: `{${convertArgument(args[0], ctx)}, number, ${args[1].value}}`;
	},
};

const nodeHandlers = {
	StringLiteral(node) {
		return node.value;
	},
	TemplateLiteral(node, ctx) {
		return convertTemplate(node, ctx);
	},
	Identifier(node, ctx) {
		return `{${ctx.addNamedArg(node)}}`;
	},
	CallExpression(node, ctx) {
		const {
			callee: {type, name},
		} = node;
		if (type === 'Identifier') {
			const macroName = ctx.localNames[name];
			if (macroName) {
				return functionHandlers[macroName](node, ctx);
			}
		}
		return `{${ctx.addNumArg(node)}}`;
	},
};

const convertArgument = (node, ctx) => (isIdentifier(node) ? ctx.addNamedArg(node) : ctx.addNumArg(node));

const convertPluralKey = ({type, name, value}) =>
	type === 'Identifier' ? name : type === 'StringLiteral' ? value : `=${value}`;

const convertSelection = (node, ctx, type, extraValidation, mapProperty) => {
	const args = node.arguments;
	if (args.length !== 2) {
		throw new Error(`This macro requires two arguments ${nodeLocation(node)}`);
	}
	const arg1 = args[1];
	if (arg1.type !== 'ObjectExpression') {
		throw new Error(`The second argument must be an object literal ${nodeLocation(arg1)}`);
	}
	const properties = arg1.properties;
	if (!properties.some(({key}) => isIdentifier(key, 'other'))) {
		throw new Error(`There must be a choice with the key "other" ${nodeLocation(arg1)}`);
	}
	extraValidation(arg1, properties);
	const choices = properties.map(mapProperty).join(' ');
	return `{${convertArgument(args[0], ctx)}, ${type}, ${choices}}`;
};

const convertPlural = (node, ctx, type) =>
	convertSelection(
		node,
		ctx,
		type,
		(arg1, properties) => {
			if (![0, -1].includes(properties.findIndex(({key}) => isIdentifier(key, 'offset')))) {
				throw new Error(`The offset must be the first choice ${nodeLocation(arg1)}`);
			}
		},
		({key, value}) =>
			isIdentifier(key, 'offset')
				? `offset:${value.value}`
				: `${convertPluralKey(key)} {${convertExpression(value, ctx)}}`
	);

const convertExpression = (node, ctx) => {
	const handler = nodeHandlers[node.type];
	return handler ? handler(node, ctx) : `{${ctx.addNumArg(node)}}`;
};

export const convertTemplate = (node, ctx) => {
	const {quasis, expressions} = node;
	const length = quasis.length;
	if (length === 1) {
		return quasis[0].value.cooked;
	}

	let string = '';
	const n = length - 1;
	for (let i = 0; i < n; ++i) {
		const expression = expressions[i];
		string += quasis[i].value.cooked + convertExpression(expression, ctx);
	}
	string += quasis[n].value.cooked;
	return string;
};

export const convertFunction = (name, node, ctx) => functionHandlers[name](node, ctx);

export const validateImport = (imported) => {
	if (!(imported.name in functionHandlers)) {
		throw new Error(`Unknown macro "${imported.name}" ${nodeLocation(imported)}`);
	}
};
