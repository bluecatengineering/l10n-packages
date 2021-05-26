import PO from 'pofile';
import loadConfig from '@bluecat/l10n-config';

import main from '../src/main';
import convert from '../src/convert';

jest.unmock('../src/main');

convert.mockReturnValue('convert');

describe('main', () => {
	it('returns expected string if output is "es"', () => {
		const buildKey = jest.fn((x) => `X${x}`);
		loadConfig.mockReturnValue({buildKey});
		PO.parse.mockReturnValue({
			items: [
				{msgid: 'foo', msgstr: ['FOO']},
				{msgid: 'bar', msgstr: []},
			],
			headers: {Language: 'baz'},
		});
		expect(main('source', 'es')).toBe('export default ["baz",{"Xfoo":"convert","Xbar":"convert"}]');
		expect(PO.parse.mock.calls).toEqual([['source']]);
		expect(convert.mock.calls).toEqual([['FOO'], ['bar']]);
	});

	it('returns expected string if output is not "es"', () => {
		const buildKey = jest.fn((x) => `X${x}`);
		loadConfig.mockReturnValue({buildKey});
		PO.parse.mockReturnValue({
			items: [
				{msgid: 'foo', msgstr: ['FOO']},
				{msgid: 'bar', msgstr: []},
			],
			headers: {Language: 'baz'},
		});
		expect(main('source', 'other')).toBe('module.exports = ["baz",{"Xfoo":"convert","Xbar":"convert"}]');
		expect(PO.parse.mock.calls).toEqual([['source']]);
		expect(buildKey.mock.calls).toEqual([['foo'], ['bar']]);
		expect(convert.mock.calls).toEqual([['FOO'], ['bar']]);
	});

	it('throws if the language header is missing', () => {
		PO.parse.mockReturnValue({items: [], headers: {}});
		expect(() => main()).toThrow('Language header is missing');
	});
});
