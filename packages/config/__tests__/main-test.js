import {createHash} from 'crypto';

import {lilconfigSync} from 'lilconfig';
import {parse} from 'yaml';

import main from '../src/main';

jest.unmock('../src/main');

jest.mock('crypto', () => ({createHash: jest.fn()}));

const anyFunction = expect.any(Function);

parse.mockReturnValue('parse');

describe('main', () => {
	it('return expected configuration', () => {
		const search = jest.fn().mockReturnValue({
			config: {foo: 'test', hashLength: 3, sourcePath: '/baz', module: 'l10n', catalogPath: 'l10n/{locale}'},
			filepath: '/foo/bar',
		});
		const digest = jest.fn().mockReturnValue('digest');
		const update = jest.fn().mockReturnValue({digest});
		lilconfigSync.mockReturnValue({search});
		createHash.mockReturnValue({update});
		const result = main();
		expect(result).toEqual({
			foo: 'test',
			hashLength: 3,
			sourcePath: '/baz',
			module: '/foo/l10n',
			catalogPath: '/foo/l10n/{locale}',
			buildKey: anyFunction,
		});
		expect(lilconfigSync.mock.calls).toEqual([['bc-l10n', expect.any(Object)]]);

		expect(lilconfigSync.mock.calls[0][1].loaders.noExt('x', 'foo: test')).toBe('parse');
		expect(parse.mock.calls).toEqual([['foo: test']]);

		expect(result.buildKey('foo-bar')).toBe('dig');
		expect(createHash.mock.calls).toEqual([['sha1']]);
		expect(update.mock.calls).toEqual([['foo-bar']]);
		expect(digest.mock.calls).toEqual([['hex']]);

		expect(() => result.buildKey('baz')).toThrow('Duplicated hash, increase hash length');
	});

	it('returns the same string if hashLength is not configured', () => {
		const search = jest.fn().mockReturnValue({
			config: {foo: 'test', module: 'l10n', catalogPath: 'l10n/{locale}'},
			filepath: '/foo/bar',
		});
		lilconfigSync.mockReturnValue({search});
		const result = main();
		expect(result).toEqual({
			foo: 'test',
			sourcePath: '/foo/src',
			module: '/foo/l10n',
			catalogPath: '/foo/l10n/{locale}',
			buildKey: anyFunction,
		});
		expect(result.buildKey('foo-bar')).toBe('foo-bar');
	});

	it('throws if search returns null', () => {
		const search = jest.fn().mockReturnValue(null);
		lilconfigSync.mockReturnValue({search});
		expect(() => main()).toThrow('L10n configuration is missing, add "bc-l10n" object to package.json');
	});

	it('throws if the config is not found', () => {
		const search = jest.fn().mockReturnValue({});
		lilconfigSync.mockReturnValue({search});
		expect(() => main()).toThrow('L10n configuration is missing, add "bc-l10n" object to package.json');
	});

	it('throws if module is missing', () => {
		const search = jest.fn().mockReturnValue({config: {}});
		lilconfigSync.mockReturnValue({search});
		expect(() => main()).toThrow('The "module" configuration is missing');
	});

	it('throws if catalogPath is missing', () => {
		const search = jest.fn().mockReturnValue({config: {module: 'l10n'}});
		lilconfigSync.mockReturnValue({search});
		expect(() => main()).toThrow('The "catalogPath" configuration is missing');
	});

	it('throws if catalogPath does not contain {locale}', () => {
		const search = jest.fn().mockReturnValue({config: {module: 'l10n', catalogPath: 'foo'}});
		lilconfigSync.mockReturnValue({search});
		expect(() => main()).toThrow('The "catalogPath" must contain a "{locale}" token');
	});
});
