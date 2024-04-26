import {readFile} from 'node:fs/promises';

import parser from '@babel/parser';
import _traverse from '@babel/traverse';
import {convertFunction, convertTemplate} from '@bluecateng/l10n-ast2icu';

import parseJS from '../src/parseJS';

jest.unmock('../src/parseJS');

jest.mock('node:fs/promises', () => ({readFile: jest.fn()}));
jest.mock('@babel/parser', () => ({parse: jest.fn()}));
jest.mock('@babel/traverse', () => ({default: jest.fn()}));

// workaround for https://github.com/babel/babel/issues/13855
const traverse = _traverse.default;

const anyObject = expect.any(Object);

describe('parseJS', () => {
	it('adds parsed strings', () => {
		const strings = new Set();
		const skip = jest.fn();
		const callNode = {callee: {type: 'Identifier', name: 'slt'}};
		readFile.mockResolvedValue('readFile');
		parser.parse.mockReturnValue('parse');
		convertTemplate.mockReturnValueOnce('s0').mockReturnValueOnce('s1');
		convertFunction.mockReturnValueOnce('s0').mockReturnValueOnce('s2');
		traverse.mockImplementation((ast, {ImportDeclaration, TaggedTemplateExpression, CallExpression}) => {
			ImportDeclaration({
				node: {
					source: {value: '@bluecateng/l10n.macro'},
					specifiers: [
						{imported: {name: 't'}, local: {name: 'tt'}},
						{imported: {name: 'select'}, local: {name: 'slt'}},
					],
				},
			});
			ImportDeclaration({node: {source: {value: 'other'}}});
			TaggedTemplateExpression({skip, node: {tag: {name: 'tt'}, quasi: 'quasi'}});
			TaggedTemplateExpression({skip, node: {tag: {name: 'tt'}, quasi: 'quasi'}});
			TaggedTemplateExpression({skip, node: {tag: {name: 'x'}}});
			CallExpression({skip, node: callNode});
			CallExpression({skip, node: callNode});
			CallExpression({skip, node: {callee: {type: 'Other'}}});
			CallExpression({skip, node: {callee: {type: 'Identifier', name: 'x'}}});
		});
		return parseJS(strings, 'test.js').then(() => {
			expect(readFile.mock.calls).toEqual([['test.js', 'utf8']]);
			expect(parser.parse.mock.calls).toEqual([
				[
					'readFile',
					{
						sourceFilename: 'test.js',
						sourceType: 'module',
						plugins: ['jsx', 'typescript', 'classProperties', 'doExpressions', 'throwExpressions'],
					},
				],
			]);
			expect(traverse.mock.calls).toEqual([['parse', anyObject]]);
			expect(skip.mock.calls).toEqual([[], [], [], []]);
			expect(convertTemplate.mock.calls).toEqual([
				['quasi', anyObject],
				['quasi', anyObject],
			]);
			expect(convertFunction.mock.calls).toEqual([
				['select', callNode, anyObject],
				['select', callNode, anyObject],
			]);
			expect(Array.from(strings)).toEqual(['s0', 's1', 's2']);

			const {addNamedArg, addNumArg} = convertTemplate.mock.calls[0][1];
			expect(addNamedArg({name: 'test'})).toBe('test');
			expect(addNumArg()).toBe(0);
			expect(addNumArg()).toBe(1);
		});
	});

	it('fails if readFile fails', () => {
		readFile.mockRejectedValue(new Error('Test error'));
		return expect(parseJS(new Set(), 'test.js')).rejects.toThrow('Error reading test.js: Test error');
	});

	it('fails if parse fails', () => {
		readFile.mockResolvedValue('readFile');
		parser.parse.mockImplementation(() => {
			throw new Error('Test error');
		});
		return expect(parseJS(new Set(), 'test.js')).rejects.toThrow('Error parsing test.js: Test error');
	});
});
