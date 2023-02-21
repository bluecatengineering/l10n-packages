import PO from 'pofile';

import updateLocale from '../src/updateLocale';

jest.unmock('../src/updateLocale');

const anyFunction = expect.any(Function);

describe('updateLocale', () => {
	it('updates the specified locale', () => {
		const strings = new Set(['s0', 's1', 's2']);
		const addReferences = jest.fn();
		const save = jest.fn((_, cb) => cb());
		const items = [{msgid: 'other'}, {msgid: 's0', obsolete: true}, {msgid: 's1'}];
		PO.Item.mockImplementation(() => ({}));
		PO.load.mockImplementation((_, cb) => cb(null, {items, save}));
		return updateLocale('en', '/foo/{locale}/bar', strings, addReferences).then(() => {
			expect(Array.from(strings)).toEqual(['s0', 's1', 's2']); // ensure is not changed
			expect(addReferences.mock.calls).toEqual([[{msgid: 's2'}]]);
			expect(PO.load.mock.calls).toEqual([['/foo/en/bar.po', anyFunction]]);

			expect(items).toEqual([{msgid: 'other'}, {msgid: 's0', obsolete: false}, {msgid: 's1'}, {msgid: 's2'}]);
			expect(save.mock.calls).toEqual([['/foo/en/bar.po', anyFunction]]);
		});
	});

	it('creates a PO file if not found', () => {
		const strings = new Set();
		const addReferences = jest.fn();
		PO.mockImplementation(() => ({}));
		PO.load.mockImplementation((_, cb) => cb({code: 'ENOENT'}, null));
		jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('toISOString');
		return updateLocale('en', '/foo/{locale}/bar', strings, addReferences).then(() => {
			expect(addReferences.mock.calls).toEqual([]);
			expect(PO.load.mock.calls).toEqual([['/foo/en/bar.po', anyFunction]]);

			expect(PO.mock.results[0].value).toEqual({
				headers: {
					'POT-Creation-Date': 'toISOString',
					'Mime-Version': '1.0',
					'Content-Type': 'text/plain; charset=utf-8',
					'Content-Transfer-Encoding': '8bit',
					'X-Generator': '@bluecateng/l10n-cli',
					Language: 'en',
				},
			});
		});
	});

	it('removes obsolete entries if requested', () => {
		const strings = new Set(['s0']);
		const addReferences = jest.fn();
		const save = jest.fn((_, cb) => cb());
		const items = [{msgid: 's0'}, {msgid: 's1'}];
		const po = {items, save};
		PO.Item.mockImplementation(() => ({}));
		PO.load.mockImplementation((_, cb) => cb(null, po));
		return updateLocale('en', '/foo/{locale}/bar', strings, addReferences, true, true).then(() => {
			expect(addReferences.mock.calls).toEqual([]);
			expect(PO.load.mock.calls).toEqual([['/foo/en/bar.po', anyFunction]]);

			expect(po.items).toEqual([{msgid: 's0'}]);
			expect(save.mock.calls).toEqual([['/foo/en/bar.po', anyFunction]]);
		});
	});

	it('fails if load fails with an error other than ENOENT', () => {
		PO.load.mockImplementation((_, cb) => cb({code: 'OTHER', message: 'Test error'}, null));
		return expect(updateLocale('en', '')).rejects.toThrow('Test error');
	});

	it('fails if save fails', () => {
		const strings = new Set(['s0']);
		const addReferences = jest.fn();
		const save = jest.fn((_, cb) => cb(new Error('Test error')));
		PO.load.mockImplementation((_, cb) => cb(null, {items: [{msgid: 's0', obsolete: true}], save}));
		return expect(updateLocale('en', '/foo/{locale}/bar', strings, addReferences)).rejects.toThrow(
			'Error saving /foo/en/bar.po: Test error'
		);
	});
});
