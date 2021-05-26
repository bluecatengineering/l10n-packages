import converter from '@bluecat/l10n-icu2obj';

import main from '../src/main';

jest.unmock('../src/main');

converter.mockReturnValue('converter');

describe('main', () => {
	it('calls converter', () => {
		expect(main('source')).toBe('converter');
		expect(converter.mock.calls).toEqual([['source', 'es']]);
	});

	it('calls emitError if converter fails', () => {
		const emitError = jest.fn();
		const err = new Error();
		converter.mockImplementation(() => {
			throw err;
		});
		expect(main.call({emitError}, 'source')).toBe('');
		expect(converter.mock.calls).toEqual([['source', 'es']]);
		expect(emitError.mock.calls).toEqual([[err]]);
	});
});
