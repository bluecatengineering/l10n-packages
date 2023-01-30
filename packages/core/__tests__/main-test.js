import {ARGUMENT, SELECT, CARDINAL, ORDINAL, OCTOTHORPE, NUMBER, DATE, TIME} from '@bluecateng/l10n-types';

import load from '../src/main';

jest.unmock('../src/main');

const messages = {
	literal: 'Simple string',
	arg1: [[ARGUMENT, 'arg']],
	arg2: ['x', [ARGUMENT, 'arg']],
	arg3: [[ARGUMENT, 'arg'], 'x'],
	arg4: ['x', [ARGUMENT, 'arg'], 'x'],
	arg5: [[ARGUMENT, 'arg0'], 'x', [ARGUMENT, 'arg1']],
	arg6: [
		[ARGUMENT, 'arg0'],
		[ARGUMENT, 'arg1'],
	],
	number: ['The answer is ', [NUMBER, 'answer']],
	percent: ['The glass is ', [NUMBER, 'value', 'percent'], ' full'],
	date: [[DATE, 'date']],
	dateShort: [[DATE, 'date', 'short']],
	time: [[TIME, 'time']],
	timeShort: [[TIME, 'time', 'short']],
	select: [[SELECT, 'value', {a: 'Alpha', other: ''}]],
	selectEmpty: [[SELECT, 'value', {a: '', other: 'other'}]],
	cardinal: [[CARDINAL, 'value', {0: 'Zero', one: 'One', other: [[OCTOTHORPE], ' other']}]],
	cardinalOffset: [
		[
			CARDINAL,
			'value',
			{
				offset: 1,
				0: 'nobody',
				1: 'you',
				one: 'you and one other',
				other: ['you and ', [OCTOTHORPE], ' other'],
			},
		],
	],
	ordinal: [
		[
			ORDINAL,
			'value',
			{
				one: [[OCTOTHORPE], 'st'],
				two: [[OCTOTHORPE], 'nd'],
				few: [[OCTOTHORPE], 'rd'],
				other: [[OCTOTHORPE], 'th'],
			},
		],
	],
	nested: ['a ', [SELECT, 'middle', {other: ['b ', [ARGUMENT, 'nested'], ' d']}], ' e'],
};

const tr = load(['en', messages]);

describe('main', () => {
	describe('unknown', () => {
		it('returns the key if the string is not found', () => {
			expect(tr('unknown')).toBe('unknown');
		});
	});

	describe('literal', () => {
		it('returns expected string', () => {
			expect(tr('literal')).toBe('Simple string');
			expect(tr.locale).toBe('en');
		});
	});

	describe('arguments', () => {
		it('returns expected string for a single argument', () => {
			expect(tr('arg1', {arg: 'test'})).toBe('test');
		});

		it('returns expected string for a string plus an argument', () => {
			expect(tr('arg2', {arg: 'test'})).toBe('xtest');
		});

		it('returns expected string for an argument plus a string', () => {
			expect(tr('arg3', {arg: 'test'})).toBe('testx');
		});

		it('returns expected string for an argument surrounded by two strings', () => {
			expect(tr('arg4', {arg: 'test'})).toBe('xtestx');
		});

		it('returns expected string for a string surrounded by two arguments', () => {
			expect(tr('arg5', {arg0: 'test0', arg1: 'test1'})).toBe('test0xtest1');
		});

		it('returns expected string for two arguments', () => {
			expect(tr('arg6', {arg0: 'test0', arg1: 'test1'})).toBe('test0test1');
		});
	});

	describe('number', () => {
		it('returns expected string', () => {
			expect(tr('number', {answer: 42})).toBe('The answer is 42');
		});

		it('returns expected string if style is percent', () => {
			expect(tr('percent', {value: 0.5})).toBe('The glass is 50% full');
		});
	});

	describe('date', () => {
		it('returns expected string', () => {
			expect(tr('date', {date: 0})).toBe('Dec 31, 1969');
			expect(tr('date', {date: 86400000})).toBe('Jan 1, 1970');
			expect(tr('dateShort', {date: 0})).toBe('12/31/69');
		});
	});

	describe('time', () => {
		it('returns expected string', () => {
			expect(tr('time', {time: 0})).toBe('7:00:00\u202fPM');
			expect(tr('time', {time: 3600000})).toBe('8:00:00\u202fPM');
			expect(tr('timeShort', {time: 0})).toBe('7:00\u202fPM');
		});
	});

	describe('select', () => {
		it('returns expected string', () => {
			expect(tr('select', {value: 'a'})).toBe('Alpha');
		});

		it('returns expected string if match is other', () => {
			expect(tr('select', {value: 'x'})).toBe('');
		});

		it('returns expected string if matched string is empty', () => {
			expect(tr('selectEmpty', {value: 'a'})).toBe('');
		});
	});

	describe('cardinal', () => {
		it('returns expected string if match is a number', () => {
			expect(tr('cardinal', {value: 0})).toBe('Zero');
		});

		it('returns expected string if match is a selection', () => {
			expect(tr('cardinal', {value: 1})).toBe('One');
		});

		it('returns expected string if match is other', () => {
			expect(tr('cardinal', {value: 2})).toBe('2 other');
		});

		it('returns expected string if offset is specified and value is 0', () => {
			expect(tr('cardinalOffset', {value: 0})).toBe('nobody');
		});

		it('returns expected string if offset is specified and value is 1', () => {
			expect(tr('cardinalOffset', {value: 1})).toBe('you');
		});

		it('returns expected string if offset is specified and match is one', () => {
			expect(tr('cardinalOffset', {value: 2})).toBe('you and one other');
		});

		it('returns expected string if offset is specified and match is other', () => {
			expect(tr('cardinalOffset', {value: 3})).toBe('you and 2 other');
		});
	});

	describe('ordinal', () => {
		it('returns expected string if match is one', () => {
			expect(tr('ordinal', {value: 21})).toBe('21st');
		});

		it('returns expected string if match is two', () => {
			expect(tr('ordinal', {value: 32})).toBe('32nd');
		});

		it('returns expected string if match is few', () => {
			expect(tr('ordinal', {value: 43})).toBe('43rd');
		});

		it('returns expected string if match is other', () => {
			expect(tr('ordinal', {value: 4})).toBe('4th');
		});
	});

	describe('nested', () => {
		it('returns expected string', () => {
			expect(tr('nested', {middle: 'x', nested: 'c'})).toBe('a b c d e');
		});
	});
});
