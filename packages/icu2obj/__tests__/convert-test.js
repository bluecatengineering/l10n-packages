import {ARGUMENT, SELECT, CARDINAL, ORDINAL, OCTOTHORPE, NUMBER, DATE, TIME} from '@bluecateng/l10n-types';

import convert from '../src/convert';

jest.unmock('../src/convert');
jest.unmock('@messageformat/parser');

const cases = [
	{name: 'literal', input: 'Simple string', output: 'Simple string'},
	{name: 'arg1', input: '{arg}', output: [[ARGUMENT, 'arg']]},
	{name: 'arg2', input: 'x{arg}', output: ['x', [ARGUMENT, 'arg']]},
	{name: 'arg3', input: '{arg}x', output: [[ARGUMENT, 'arg'], 'x']},
	{name: 'arg4', input: 'x{arg}x', output: ['x', [ARGUMENT, 'arg'], 'x']},
	{name: 'arg5', input: '{arg0}x{arg1}', output: [[ARGUMENT, 'arg0'], 'x', [ARGUMENT, 'arg1']]},
	{
		name: 'arg6',
		input: '{arg0}{arg1}',
		output: [
			[ARGUMENT, 'arg0'],
			[ARGUMENT, 'arg1'],
		],
	},
	{name: 'number', input: 'The answer is {answer, number}', output: ['The answer is ', [NUMBER, 'answer']]},
	{
		name: 'percent',
		input: 'The glass is {value, number, percent} full',
		output: ['The glass is ', [NUMBER, 'value', 'percent'], ' full'],
	},
	{name: 'date', input: '{date, date, short}', output: [[DATE, 'date', 'short']]},
	{name: 'time', input: '{time, time, medium}', output: [[TIME, 'time', 'medium']]},
	{name: 'select', input: '{value, select, a {Alpha} other {}}', output: [[SELECT, 'value', {a: 'Alpha', other: ''}]]},
	{
		name: 'cardinal',
		input: '{value, plural, =0 {Zero} one {One} other {# other}}',
		output: [[CARDINAL, 'value', {0: 'Zero', one: 'One', other: [[OCTOTHORPE], ' other']}]],
	},
	{
		name: 'cardinalOffset',
		input: '{value, plural, offset:1 =0 {nobody} =1 {you} one {you and one other} other {you and # other}}',
		output: [
			[
				CARDINAL,
				'value',
				{offset: 1, 0: 'nobody', 1: 'you', one: 'you and one other', other: ['you and ', [OCTOTHORPE], ' other']},
			],
		],
	},
	{
		name: 'ordinal',
		input: '{value, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
		output: [
			[
				ORDINAL,
				'value',
				{one: [[OCTOTHORPE], 'st'], two: [[OCTOTHORPE], 'nd'], few: [[OCTOTHORPE], 'rd'], other: [[OCTOTHORPE], 'th']},
			],
		],
	},
	{
		name: 'nested',
		input: 'a {middle, select, other {b {nested} d}} e',
		output: ['a ', [SELECT, 'middle', {other: ['b ', [ARGUMENT, 'nested'], ' d']}], ' e'],
	},
];

describe('convert', () => {
	cases.forEach(({name, input, output}) => it(`converts ${name}`, () => expect(convert(input)).toEqual(output)));

	it('throws if the input has an error', () => {
		expect(() => convert('{bad input')).toThrow('invalid syntax at line 1 col 6');
	});
});
