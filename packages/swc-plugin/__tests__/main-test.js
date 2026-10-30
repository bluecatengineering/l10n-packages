import loadConfig from '@bluecateng/l10n-config';

import main from '../src/main';

jest.unmock('../src/main');

loadConfig.mockReturnValue({module: '/foo/l10n', hashLength: 3, catalogPath: '/foo/l10n/{locale}'});

describe('main', () => {
	it('returns the plugin entry', () => {
		expect(main()).toEqual(['@bluecateng/l10n-swc-plugin', {module: '/foo/l10n', hashLength: 3}]);
	});

	it('merges the specified options', () => {
		expect(main({module: 'src/l10n'})).toEqual(['@bluecateng/l10n-swc-plugin', {module: 'src/l10n', hashLength: 3}]);
	});
});
