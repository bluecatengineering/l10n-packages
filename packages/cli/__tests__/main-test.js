import {promises} from 'fs';

import PO from 'pofile';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import loadConfig from '@bluecat/l10n-config';
import {convertFunction, convertTemplate} from '@bluecat/l10n-ast2icu';

import main from '../src/main';

jest.unmock('../src/main');

jest.mock('fs', () => ({promises: {opendir: jest.fn(), readFile: jest.fn()}}));
jest.mock('@babel/parser', () => ({parse: jest.fn()}));
jest.mock('@babel/traverse', () => jest.fn());

const anyObject = expect.any(Object);
const anyFunction = expect.any(Function);

const {opendir, readFile} = promises;

describe('main', () => {
	it('updates the specified locale for the specified sources', () => {
		const buildKey = jest.fn((x) => `X${x}`);
		const skip = jest.fn();
		const callNode = {callee: {type: 'Identifier', name: 'slt'}};
		const save = jest.fn((_, cb) => cb(new Error('Test error')));
		const items = [{msgid: 'other'}, {msgid: 's0', obsolete: true}, {msgid: 's1'}];
		loadConfig.mockReturnValue({hashLength: 3, catalogPath: '/foo/{locale}', locales: ['en', 'fr'], buildKey});
		readFile.mockResolvedValue('readFileSync');
		parser.parse.mockReturnValue('parse');
		convertTemplate.mockReturnValueOnce('s0').mockReturnValueOnce('s1');
		convertFunction.mockReturnValueOnce('s0').mockReturnValueOnce('s2');
		traverse.mockImplementation((ast, {ImportDeclaration, TaggedTemplateExpression, CallExpression}) => {
			ImportDeclaration({
				node: {
					source: {value: '@bluecat/l10n.macro'},
					specifiers: [
						{imported: {name: 't'}, local: {name: 'tt'}},
						{imported: {name: 'select'}, local: {name: 'slt'}},
					],
				},
			});
			ImportDeclaration({node: {source: {value: 'other'}}});
			TaggedTemplateExpression({skip, node: {tag: {name: 'tt'}, quasi: 'quasi'}});
			TaggedTemplateExpression({skip, node: {tag: {name: 'x'}}});
			CallExpression({skip, node: callNode});
			CallExpression({skip, node: {callee: {type: 'Other'}}});
			CallExpression({skip, node: {callee: {type: 'Identifier', name: 'x'}}});
		});
		PO.Item.mockImplementation(() => ({}));
		PO.load.mockImplementation((_, cb) => cb(null, {items, save}));
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(process, 'exit').mockImplementation(() => {});

		return main('en', ['/foo/bar.js', '/foo/baz.jsx', '/foo/blah.x']).then(() => {
			expect(readFile.mock.calls).toEqual([
				['/foo/bar.js', 'utf8'],
				['/foo/baz.jsx', 'utf8'],
			]);
			expect(parser.parse.mock.calls).toEqual([
				[
					'readFileSync',
					{
						sourceFilename: '/foo/bar.js',
						sourceType: 'module',
						plugins: ['jsx', 'classProperties', 'doExpressions', 'throwExpressions'],
					},
				],
				[
					'readFileSync',
					{
						sourceFilename: '/foo/baz.jsx',
						sourceType: 'module',
						plugins: ['jsx', 'classProperties', 'doExpressions', 'throwExpressions'],
					},
				],
			]);
			expect(traverse.mock.calls).toEqual([
				['parse', anyObject],
				['parse', anyObject],
			]);
			expect(convertTemplate.mock.calls).toEqual([
				['quasi', anyObject],
				['quasi', anyObject],
			]);
			expect(convertFunction.mock.calls).toEqual([
				['select', callNode, anyObject],
				['select', callNode, anyObject],
			]);
			expect(skip.mock.calls).toEqual([[], [], [], []]);
			expect(PO.load.mock.calls).toEqual([['/foo/en.po', anyFunction]]);

			const {addNamedArg, addNumArg} = convertTemplate.mock.calls[0][1];
			expect(addNamedArg({name: 'test'})).toBe('test');
			expect(addNumArg()).toBe(0);
			expect(addNumArg()).toBe(1);

			expect(items).toEqual([
				{msgid: 'other'},
				{msgid: 's0', obsolete: false},
				{msgid: 's1'},
				{msgid: 's2', references: ['Xs2']},
			]);
			expect(save.mock.calls).toEqual([['/foo/en.po', anyFunction]]);

			expect(console.error.mock.calls).toEqual([['Error saving /foo/en.po: Test error']]);
			expect(process.exit.mock.calls).toEqual([[1]]);
		});
	});

	it('scans all sources and updates all locales if no arguments are specified', () => {
		const read = jest.fn();
		const close = jest.fn();
		const isDirectory = jest.fn();
		const isFile = jest.fn();
		const skip = jest.fn();
		const save = jest.fn((_, cb) => cb());
		const items = [{msgid: 's1'}];
		loadConfig.mockReturnValue({catalogPath: '/foo/{locale}', locales: ['en', 'fr']});
		opendir.mockResolvedValue({read, close});
		read
			.mockResolvedValueOnce({name: 'd0', isDirectory})
			.mockResolvedValueOnce({name: 'f0.js', isDirectory, isFile})
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({name: 'f1.x', isDirectory, isFile})
			.mockResolvedValueOnce({name: 'f2.js', isDirectory, isFile})
			.mockResolvedValueOnce(null);
		isDirectory
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(false);
		isFile.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false);
		readFile.mockResolvedValue('readFileSync');
		parser.parse.mockReturnValue('parse');
		convertTemplate.mockReturnValueOnce('s0');
		traverse.mockImplementation((ast, {ImportDeclaration, TaggedTemplateExpression}) => {
			ImportDeclaration({
				node: {
					source: {value: '@bluecat/l10n.macro'},
					specifiers: [{imported: {name: 't'}, local: {name: 'tt'}}],
				},
			});
			TaggedTemplateExpression({skip, node: {tag: {name: 'tt'}, quasi: 'quasi'}});
		});
		PO.load.mockImplementation((_, cb) => cb(null, {items, save}));
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(process, 'exit').mockImplementation(() => {});

		return main(undefined, []).then(() => {
			expect(readFile.mock.calls).toEqual([['src/d0/f0.js', 'utf8']]);
			expect(PO.load.mock.calls).toEqual([
				['/foo/en.po', anyFunction],
				['/foo/fr.po', anyFunction],
			]);

			expect(items).toEqual([{msgid: 's0'}, {msgid: 's1', obsolete: true}]);
			expect(save.mock.calls).toEqual([
				['/foo/en.po', anyFunction],
				['/foo/fr.po', anyFunction],
			]);

			expect(console.error.mock.calls).toEqual([]);
			expect(process.exit.mock.calls).toEqual([]);
		});
	});

	it('defaults to english if no locales are specified', () => {
		const read = jest.fn();
		const close = jest.fn();
		loadConfig.mockReturnValue({catalogPath: '/foo/{locale}'});
		opendir.mockResolvedValue({read, close});
		read.mockResolvedValueOnce(null);
		readFile.mockResolvedValue('readFileSync');
		parser.parse.mockReturnValue('parse');
		PO.mockImplementation(() => ({}));
		PO.load.mockImplementation((_, cb) => cb({code: 'ENOENT'}, null));
		jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('toISOString');

		return main(undefined, []).then(() => {
			expect(PO.load.mock.calls).toEqual([['/foo/en.po', anyFunction]]);

			expect(PO.mock.results[0].value).toEqual({
				headers: {
					'POT-Creation-Date': 'toISOString',
					'Mime-Version': '1.0',
					'Content-Type': 'text/plain; charset=utf-8',
					'Content-Transfer-Encoding': '8bit',
					'X-Generator': '@bluecat/l10n-cli',
					Language: 'en',
				},
			});
		});
	});

	it('logs an error if readFile fails', () => {
		readFile.mockRejectedValue(new Error('Test error'));
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(process, 'exit').mockImplementation(() => {});
		return main('en', ['/foo/bar.js']).then(() => {
			expect(console.error.mock.calls).toEqual([['Error reading /foo/bar.js: Test error']]);
			expect(process.exit.mock.calls).toEqual([[1]]);
		});
	});

	it('logs an error if parse fails', () => {
		readFile.mockResolvedValue('readFileSync');
		parser.parse.mockImplementation(() => {
			throw new Error('Test error');
		});
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(process, 'exit').mockImplementation(() => {});
		return main('en', ['/foo/bar.js']).then(() => {
			expect(console.error.mock.calls).toEqual([['Error parsing /foo/bar.js: Test error']]);
			expect(process.exit.mock.calls).toEqual([[1]]);
		});
	});

	it('logs an error if PO.load fails with an error other than ENOENT', () => {
		loadConfig.mockReturnValue({catalogPath: '/foo/{locale}'});
		readFile.mockResolvedValue('readFileSync');
		parser.parse.mockReturnValue('parse');
		PO.load.mockImplementation((_, cb) => cb({code: 'OTHER', message: 'Test error'}, null));
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(process, 'exit').mockImplementation(() => {});

		return main('en', ['/foo/bar.js']).then(() => {
			expect(PO.load.mock.calls).toEqual([['/foo/en.po', anyFunction]]);

			expect(console.error.mock.calls).toEqual([['Error loading /foo/en.po: Test error']]);
			expect(process.exit.mock.calls).toEqual([[1]]);
		});
	});
});
