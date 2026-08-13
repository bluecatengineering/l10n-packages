import {mkdir, readFile, writeFile} from 'node:fs/promises';

import loadConfig from '@bluecateng/l10n-config';
import compile from '@bluecateng/l10n-icu2obj';

import build from '../src/build';

jest.unmock('../src/build');

jest.mock('node:fs/promises', () => ({mkdir: jest.fn(), readFile: jest.fn(), writeFile: jest.fn()}));

describe('build', () => {
	it('compiles the catalog for every configured locale', () => {
		loadConfig.mockReturnValue({sourcePath: '/foo', catalogPath: '/foo/l10n/{locale}', locales: ['en', 'fr']});
		readFile.mockResolvedValue('source');
		compile.mockReturnValue('compiled');
		mkdir.mockResolvedValue();
		writeFile.mockResolvedValue();

		return build('/dist').then(() => {
			expect(readFile.mock.calls).toEqual([
				['/foo/l10n/en.po', 'utf8'],
				['/foo/l10n/fr.po', 'utf8'],
			]);
			expect(compile.mock.calls).toEqual([
				['source', 'es'],
				['source', 'es'],
			]);
			expect(mkdir.mock.calls).toEqual([
				['/dist/l10n', {recursive: true}],
				['/dist/l10n', {recursive: true}],
			]);
			expect(writeFile.mock.calls).toEqual([
				['/dist/l10n/en.po.js', 'compiled'],
				['/dist/l10n/fr.po.js', 'compiled'],
			]);
		});
	});

	it('defaults to english if no locales are specified', () => {
		loadConfig.mockReturnValue({sourcePath: '/foo', catalogPath: '/foo/l10n/{locale}'});
		readFile.mockResolvedValue('source');
		compile.mockReturnValue('compiled');
		mkdir.mockResolvedValue();
		writeFile.mockResolvedValue();

		return build('/dist').then(() => {
			expect(writeFile.mock.calls).toEqual([['/dist/l10n/en.po.js', 'compiled']]);
		});
	});

	it('logs an error and exits if compilation fails', () => {
		loadConfig.mockReturnValue({sourcePath: '/foo', catalogPath: '/foo/l10n/{locale}', locales: ['en']});
		readFile.mockRejectedValue(new Error('Test error'));
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(process, 'exit').mockImplementation(() => {});

		return build('/dist').then(() => {
			expect(console.error.mock.calls).toEqual([[new Error('Test error')]]);
			expect(process.exit.mock.calls).toEqual([[1]]);
		});
	});
});
