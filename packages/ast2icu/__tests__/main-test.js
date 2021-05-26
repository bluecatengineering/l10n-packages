import {convertTemplate, convertFunction, validateImport} from '../src/main';

jest.unmock('../src/main');

describe('main', () => {
	describe('convertTemplate', () => {
		it('returns the cooked value if only one quasi is present', () => {
			expect(convertTemplate({quasis: [{value: {cooked: 'Test'}}]})).toBe('Test');
		});

		it('converts nested expressions', () => {
			const localNames = {tt: 't', slt: 'select'};
			const addNamedArg = jest.fn().mockReturnValueOnce('n0').mockReturnValueOnce('n1');
			const addNumArg = jest.fn().mockReturnValueOnce(0).mockReturnValueOnce(1).mockReturnValueOnce(2);
			const named0 = {type: 'Identifier', name: 'n0'};
			const num0 = {type: 'Other'};
			const num1 = {type: 'CallExpression', callee: {type: 'Other'}};
			const num2 = {type: 'CallExpression', callee: {type: 'Identifier', name: 'x'}};
			expect(
				convertTemplate(
					{
						quasis: [
							{value: {cooked: 'a '}},
							{value: {cooked: ' b '}},
							{value: {cooked: ' c '}},
							{value: {cooked: ' d '}},
							{value: {cooked: ' e '}},
							{value: {cooked: ' f '}},
							{value: {cooked: ' g '}},
							{value: {cooked: ' h'}},
						],
						expressions: [
							num0,
							named0,
							{type: 'StringLiteral', value: 'string'},
							{type: 'TemplateLiteral', quasis: [{value: {cooked: 'tmpl'}}]},
							num1,
							num2,
							{
								type: 'CallExpression',
								callee: {type: 'Identifier', name: 'tt'},
								arguments: [{type: 'StringLiteral', value: 'nested'}],
							},
						],
					},
					{localNames, addNamedArg, addNumArg}
				)
			).toBe('a {0} b {n0} c string d tmpl e {1} f {2} g nested h');
			expect(addNamedArg.mock.calls).toEqual([[named0]]);
			expect(addNumArg.mock.calls).toEqual([[num0], [num1], [num2]]);
		});
	});

	describe('convertFunction', () => {
		it('converts a call to select', () => {
			const addNamedArg = jest.fn().mockReturnValueOnce('n0');
			const named0 = {type: 'Identifier', name: 'n0'};
			const node = {
				type: 'CallExpression',
				callee: {type: 'Identifier', name: 'select'},
				arguments: [
					named0,
					{
						type: 'ObjectExpression',
						properties: [
							{
								type: 'ObjectProperty',
								key: {type: 'NumericLiteral', value: 1},
								value: {type: 'StringLiteral', value: 'A'},
							},
							{
								type: 'ObjectProperty',
								key: {type: 'Identifier', name: 'other'},
								value: {type: 'StringLiteral', value: 'B'},
							},
						],
					},
				],
			};
			const ctx = {addNamedArg};
			expect(convertFunction('select', node, ctx)).toBe('{n0, select, 1 {A} other {B}}');
			expect(addNamedArg.mock.calls).toEqual([[named0]]);
		});

		it('converts a call to plural', () => {
			const addNamedArg = jest.fn().mockReturnValueOnce('n0');
			const named0 = {type: 'Identifier', name: 'n0'};
			const node = {
				type: 'CallExpression',
				callee: {type: 'Identifier', name: 'plural'},
				arguments: [
					named0,
					{
						type: 'ObjectExpression',
						properties: [
							{
								type: 'ObjectProperty',
								key: {type: 'NumericLiteral', value: 0},
								value: {type: 'StringLiteral', value: 'Zero'},
							},
							{
								type: 'ObjectProperty',
								key: {type: 'StringLiteral', value: 'one'},
								value: {type: 'StringLiteral', value: 'One'},
							},
							{
								type: 'ObjectProperty',
								key: {type: 'Identifier', name: 'other'},
								value: {type: 'StringLiteral', value: 'More'},
							},
						],
					},
				],
			};
			const ctx = {addNamedArg};
			expect(convertFunction('plural', node, ctx)).toBe('{n0, plural, =0 {Zero} one {One} other {More}}');
			expect(addNamedArg.mock.calls).toEqual([[named0]]);
		});

		it('converts a call to selectOrdinal', () => {
			const addNamedArg = jest.fn().mockReturnValueOnce('n0');
			const named0 = {type: 'Identifier', name: 'n0'};
			const node = {
				type: 'CallExpression',
				callee: {type: 'Identifier', name: 'selectOrdinal'},
				arguments: [
					named0,
					{
						type: 'ObjectExpression',
						properties: [
							{
								type: 'ObjectProperty',
								key: {type: 'Identifier', name: 'offset'},
								value: {type: 'NumericLiteral', value: 1},
							},
							{
								type: 'ObjectProperty',
								key: {type: 'NumericLiteral', value: 0},
								value: {type: 'StringLiteral', value: 'Zero'},
							},
							{
								type: 'ObjectProperty',
								key: {type: 'Identifier', name: 'one'},
								value: {type: 'StringLiteral', value: 'One'},
							},
							{
								type: 'ObjectProperty',
								key: {type: 'Identifier', name: 'other'},
								value: {type: 'StringLiteral', value: 'More'},
							},
						],
					},
				],
			};
			const ctx = {addNamedArg};
			expect(convertFunction('selectOrdinal', node, ctx)).toBe(
				'{n0, selectordinal, offset:1 =0 {Zero} one {One} other {More}}'
			);
			expect(addNamedArg.mock.calls).toEqual([[named0]]);
		});

		it('converts a call to number', () => {
			const addNumArg = jest.fn().mockReturnValueOnce(0);
			const num0 = {type: 'Other'};
			const node = {
				type: 'CallExpression',
				callee: {type: 'Identifier', name: 'number'},
				arguments: [num0],
			};
			const ctx = {addNumArg};
			expect(convertFunction('number', node, ctx)).toBe('{0, number}');
			expect(addNumArg.mock.calls).toEqual([[num0]]);
		});

		it('converts a call to number if style is specified', () => {
			const addNumArg = jest.fn().mockReturnValueOnce(0);
			const num0 = {type: 'Other'};
			const node = {
				type: 'CallExpression',
				callee: {type: 'Identifier', name: 'number'},
				arguments: [num0, {type: 'StringLiteral', value: 'percent'}],
			};
			const ctx = {addNumArg};
			expect(convertFunction('number', node, ctx)).toBe('{0, number, percent}');
			expect(addNumArg.mock.calls).toEqual([[num0]]);
		});

		it('throws if the call to t does not have one arguments', () => {
			expect(() => convertFunction('t', {arguments: [], loc: {start: {line: 1, column: 5}}})).toThrow(
				'This macro requires one argument (1:6)'
			);
		});

		it('throws if the call to select does not have two arguments', () => {
			expect(() => convertFunction('select', {arguments: [], loc: {start: {line: 1, column: 5}}})).toThrow(
				'This macro requires two arguments (1:6)'
			);
		});

		it('throws if the second argument of select is not an object literal', () => {
			expect(() =>
				convertFunction('select', {arguments: [{}, {type: 'Other', loc: {start: {line: 1, column: 5}}}]})
			).toThrow('The second argument must be an object literal (1:6)');
		});

		it('throws if the select arguments do not contain other', () => {
			expect(() =>
				convertFunction('select', {
					arguments: [{}, {type: 'ObjectExpression', properties: [], loc: {start: {line: 1, column: 5}}}],
				})
			).toThrow('There must be a choice with the key "other" (1:6)');
		});

		it('throws if the plural arguments contain offset not as the first property', () => {
			expect(() =>
				convertFunction('plural', {
					arguments: [
						{},
						{
							type: 'ObjectExpression',
							properties: [{key: {type: 'Identifier', name: 'other'}}, {key: {type: 'Identifier', name: 'offset'}}],
							loc: {start: {line: 1, column: 5}},
						},
					],
				})
			).toThrow('The offset must be the first choice (1:6)');
		});

		it('throws if the call to number does not have one or two arguments', () => {
			expect(() => convertFunction('number', {arguments: [], loc: {start: {line: 1, column: 5}}})).toThrow(
				'This macro requires one or two arguments (1:6)'
			);
		});

		it('throws if the second argument of number is not a string literal', () => {
			expect(() =>
				convertFunction('number', {arguments: [{}, {type: 'Other', loc: {start: {line: 1, column: 5}}}]})
			).toThrow('The second argument must be a string literal (1:6)');
		});
	});

	describe('validateImport', () => {
		it('throws if the macro is not found', () => {
			expect(() => validateImport({name: 'foo', loc: {start: {line: 1, column: 5}}})).toThrow(
				'Unknown macro "foo" (1:6)'
			);
		});

		it('does not throw if the macro is found', () => {
			expect(() => validateImport({name: 't'})).not.toThrow();
		});
	});
});
