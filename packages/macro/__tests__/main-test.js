import {addDefault} from '@babel/helper-module-imports';
import {convertFunction, convertTemplate} from '@bluecat/l10n-ast2icu';

import main from '../src/main';

jest.unmock('../src/main');

jest.mock('babel-plugin-macros', () => ({createMacro: (f) => f}));
jest.mock('@babel/helper-module-imports', () => ({addDefault: jest.fn()}));
jest.mock('@bluecat/l10n-config', () => () => ({buildKey: (x) => `X${x}`, module: '/foo/bar'}));

const anyObject = expect.any(Object);
const types = {
	callExpression: (callee, args) => ({type: 'CallExpression', callee, args}),
	identifier: (name) => ({type: 'Identifier', name}),
	numericLiteral: (value) => ({type: 'NumericLiteral', value}),
	objectExpression: (props) => ({type: 'ObjectExpression', props}),
	objectProperty: (key, value, computed, shorthand) => ({type: 'ObjectProperty', key, value, computed, shorthand}),
	stringLiteral: (value) => ({type: 'StringLiteral', value}),
	cloneDeep: (object) => ({...object}),
};

addDefault.mockReturnValue({type: 'default'});
convertTemplate.mockReturnValue('convertTemplate');
convertFunction.mockImplementation((name, node, ctx) => {
	ctx.addNamedArg({name: 'foo'});
	ctx.addNumArg({type: 'Other'});
	return 'convertFunction';
});

describe('main', () => {
	it('calls replaceWith with new node', () => {
		const addComment = jest.fn();
		const replaceWith = jest.fn();
		const templatePath = {
			node: {type: 'TaggedTemplateExpression', quasi: 'quasi', loc: 'loc1'},
			addComment,
			replaceWith,
		};
		const references = {
			t: [
				{
					node: {name: 'tt'},
					parentPath: templatePath,
				},
			],
			select: [
				{
					node: {name: 'slt'},
					parentPath: {node: {type: 'CallExpression', callee: {name: 'slt'}, loc: 'loc2'}, addComment, replaceWith},
				},
				{
					parentPath: {parentPath: templatePath},
				},
				{
					parentPath: {parentPath: {parentPath: templatePath}},
				},
			],
		};
		const path = {type: 'path'};
		const state = {filename: '/foo/baz.js', file: {path}};
		main({references, state, babel: {types}});
		expect(addDefault.mock.calls).toEqual([[path, './bar', {nameHint: 'l10n', importPosition: 'after'}]]);
		expect(convertTemplate.mock.calls).toEqual([['quasi', anyObject]]);
		expect(addComment.mock.calls).toEqual([
			['leading', 'l10n: convertTemplate'],
			['leading', 'l10n: convertFunction'],
		]);
		expect(replaceWith.mock.calls).toEqual([
			[
				{
					type: 'CallExpression',
					callee: {type: 'default'},
					args: [{type: 'StringLiteral', value: 'XconvertTemplate'}],
					loc: 'loc1',
				},
			],
			[
				{
					type: 'CallExpression',
					callee: {type: 'default'},
					args: [
						{type: 'StringLiteral', value: 'XconvertFunction'},
						{
							type: 'ObjectExpression',
							props: [
								{
									type: 'ObjectProperty',
									key: {type: 'Identifier', name: 'foo'},
									value: {type: 'Identifier', name: 'foo'},
									computed: false,
									shorthand: true,
								},
								{type: 'ObjectProperty', key: {type: 'NumericLiteral', value: 0}, value: {type: 'Other'}},
							],
						},
					],
					loc: 'loc2',
				},
			],
		]);
	});

	it('does not call addComment if environment is production', () => {
		const addComment = jest.fn();
		const replaceWith = jest.fn();
		const references = {
			t: [
				{
					node: {name: 'tt'},
					parentPath: {node: {type: 'TaggedTemplateExpression', quasi: 'quasi', loc: 'loc'}, addComment, replaceWith},
				},
			],
		};
		const path = {type: 'path'};
		const state = {filename: '/foo/blah/waa.js', file: {path}};
		process.env.NODE_ENV = 'production';
		main({references, state, babel: {types}});
		expect(addDefault.mock.calls).toEqual([[path, '../bar', {nameHint: 'l10n', importPosition: 'after'}]]);
		expect(addComment.mock.calls).toEqual([]);
		expect(replaceWith.mock.calls).toEqual([
			[
				{
					type: 'CallExpression',
					callee: {type: 'default'},
					args: [{type: 'StringLiteral', value: 'XconvertTemplate'}],
					loc: 'loc',
				},
			],
		]);
	});
});
