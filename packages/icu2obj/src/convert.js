import {parse} from '@messageformat/parser';
import {ARGUMENT, SELECT, CARDINAL, ORDINAL, OCTOTHORPE, NUMBER, DATE, TIME} from '@bluecateng/l10n-types';

const keyToType = {
	number: NUMBER,
	date: DATE,
	time: TIME,
};

const tokenHandlers = {
	content: ({value}) => value,
	argument: ({arg}) => [ARGUMENT, arg],
	octothorpe: () => [OCTOTHORPE],
	select: ({arg, cases}) => [SELECT, arg, processCases(cases)],
	plural: ({arg, cases, pluralOffset}) => [CARDINAL, arg, processCases(cases, pluralOffset)],
	selectordinal: ({arg, cases, pluralOffset}) => [ORDINAL, arg, processCases(cases, pluralOffset)],
	function: ({key, arg, param}) => (param ? [keyToType[key], arg, param[0].value] : [keyToType[key], arg]),
};

const processCases = (cases, offset) => {
	const entries = cases.map(({key, tokens}) => [key[0] === '=' ? +key.slice(1) : key, process(tokens)]);
	if (offset) {
		entries.unshift(['offset', offset]);
	}
	return Object.fromEntries(entries);
};

const process = (ast) => {
	if (ast.length === 0) {
		return '';
	}
	if (ast.length === 1 && ast[0].type === 'content') {
		return ast[0].value;
	}
	return ast.map((token) => tokenHandlers[token.type](token));
};

export default (input) => process(parse(input, {strict: true}));
