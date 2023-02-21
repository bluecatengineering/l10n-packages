import loadConfig from '@bluecateng/l10n-config';

import main from '../src/main';
import parseJS from '../src/parseJS';
import updateLocale from '../src/updateLocale';
import scanDir from '../src/scanDir';

jest.unmock('../src/main');

jest.mock('@babel/traverse', () => ({default: jest.fn()}));

const anyFunction = expect.any(Function);

describe('main', () => {
	it('updates the specified locale for the specified sources', () => {
		const empty = new Set();
		const buildKey = jest.fn((x) => `X${x}`);
		loadConfig.mockReturnValue({
			hashLength: 3,
			sourcePath: '/foo',
			catalogPath: '/foo/{locale}',
			locales: ['en', 'fr'],
			buildKey,
		});
		jest.spyOn(process, 'cwd').mockReturnValue('/foo');

		return main(false, 'en', ['bar.js', '/foo/baz.jsx', '/foo/blah.x', '/x/y.js']).then(() => {
			expect(parseJS.mock.calls).toEqual([
				[empty, '/foo/bar.js'],
				[empty, '/foo/baz.jsx'],
			]);
			expect(updateLocale.mock.calls).toEqual([['en', '/foo/{locale}', empty, anyFunction, false]]);

			const item = {msgid: 'foo'};
			updateLocale.mock.calls[0][3](item);
			expect(buildKey.mock.calls).toEqual([['foo']]);
			expect(item).toEqual({msgid: 'foo', references: ['Xfoo']});
		});
	});

	it('scans all sources and updates all locales if no arguments are specified', () => {
		const empty = new Set();
		loadConfig.mockReturnValue({sourcePath: '/foo', catalogPath: '/foo/{locale}', locales: ['en', 'fr']});
		scanDir.mockResolvedValue();

		return main(true, undefined, []).then(() => {
			expect(scanDir.mock.calls).toEqual([[empty, '/foo', /\.jsx?$/]]);
			expect(updateLocale.mock.calls).toEqual([
				['en', '/foo/{locale}', empty, anyFunction, true, true],
				['fr', '/foo/{locale}', empty, anyFunction, true, true],
			]);

			const item = {msgid: 'foo'};
			updateLocale.mock.calls[0][3](item);
			expect(item).toEqual({msgid: 'foo'});
		});
	});

	it('defaults to english if no locales are specified', () => {
		const empty = new Set();
		loadConfig.mockReturnValue({sourcePath: '/foo', catalogPath: '/foo/{locale}'});
		scanDir.mockResolvedValue();

		return main(false, undefined, []).then(() => {
			expect(scanDir.mock.calls).toEqual([[empty, '/foo', /\.jsx?$/]]);
			expect(updateLocale.mock.calls).toEqual([['en', '/foo/{locale}', empty, anyFunction, false, true]]);
		});
	});

	it('logs an error if scanDir fails', () => {
		loadConfig.mockReturnValue({catalogPath: '/foo/{locale}'});
		scanDir.mockRejectedValue(new Error('Test error'));
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(process, 'exit').mockImplementation(() => {});

		return main(false, 'en', []).then(() => {
			expect(console.error.mock.calls).toEqual([[new Error('Test error')]]);
			expect(process.exit.mock.calls).toEqual([[1]]);
		});
	});
});
