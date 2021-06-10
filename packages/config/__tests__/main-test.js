import {createHash} from 'crypto';

import {cosmiconfigSync} from 'cosmiconfig';

import main from '../src/main';

jest.unmock('../src/main');

jest.mock('crypto', () => ({createHash: jest.fn()}));

const anyFunction = expect.any(Function);

describe('main', () => {
	it('return expected configuration', () => {
		const search = jest.fn().mockReturnValue({
			config: {foo: 'test', hashLength: 3, module: 'l10n', catalogPath: 'l10n/{locale}'},
			filepath: '/foo/bar',
		});
		const digest = jest.fn().mockReturnValue('digest');
		const update = jest.fn().mockReturnValue({digest});
		cosmiconfigSync.mockReturnValue({search});
		createHash.mockReturnValue({update});
		const result = main();
		expect(result).toEqual({
			foo: 'test',
			hashLength: 3,
			module: '/foo/l10n',
			catalogPath: '/foo/l10n/{locale}',
			buildKey: anyFunction,
		});
		expect(cosmiconfigSync.mock.calls).toEqual([['bc-l10n']]);

		expect(result.buildKey('foo-bar')).toBe('dig');
		expect(createHash.mock.calls).toEqual([['sha1']]);
		expect(update.mock.calls).toEqual([['foo-bar']]);
		expect(digest.mock.calls).toEqual([['hex']]);

		expect(() => result.buildKey('baz')).toThrow('Duplicated hash, increase hash length');
	});

	it('returns the same string if x is not configured', () => {
		const search = jest.fn().mockReturnValue({
			config: {foo: 'test', module: 'l10n', catalogPath: 'l10n/{locale}'},
			filepath: '/foo/bar',
		});
		cosmiconfigSync.mockReturnValue({search});
		const result = main();
		expect(result.buildKey('foo-bar')).toBe('foo-bar');
	});

	it('throws if the config is not found', () => {
		const search = jest.fn().mockReturnValue({});
		cosmiconfigSync.mockReturnValue({search});
		expect(() => main()).toThrow('L10n configuration is missing, add "bc-l10n" object to package.json');
	});

	it('throws if module is missing', () => {
		const search = jest.fn().mockReturnValue({config: {}});
		cosmiconfigSync.mockReturnValue({search});
		expect(() => main()).toThrow('The "module" configuration is missing');
	});

	it('throws if catalogPath is missing', () => {
		const search = jest.fn().mockReturnValue({config: {module: 'l10n'}});
		cosmiconfigSync.mockReturnValue({search});
		expect(() => main()).toThrow('The "catalogPath" configuration is missing');
	});

	it('throws if catalogPath does not contain {locale}', () => {
		const search = jest.fn().mockReturnValue({config: {module: 'l10n', catalogPath: 'foo'}});
		cosmiconfigSync.mockReturnValue({search});
		expect(() => main()).toThrow('The "catalogPath" must contain a "{locale}" token');
	});
});
