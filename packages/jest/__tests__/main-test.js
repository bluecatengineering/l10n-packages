import converter from '@bluecateng/l10n-icu2obj';

import main from '../src/main';

jest.unmock('../src/main');

converter.mockReturnValue('converter');

describe('main', () => {
	it('calls converter', () => {
		expect(main.process('source')).toEqual({code: 'converter'});
		expect(converter.mock.calls).toEqual([['source', 'node']]);
	});
});
