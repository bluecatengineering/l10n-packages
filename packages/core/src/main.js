import {ARGUMENT, SELECT, CARDINAL, ORDINAL, OCTOTHORPE, NUMBER, DATE, TIME} from '@bluecat/l10n-types';

const cardinal = (ctx, value) => {
	let rules = ctx.cardinal;
	if (!rules) {
		ctx.cardinal = rules = new Intl.PluralRules(ctx.locale);
	}
	return rules.select(value);
};

const ordinal = (ctx, value) => {
	let rules = ctx.ordinal;
	if (!rules) {
		ctx.ordinal = rules = new Intl.PluralRules(ctx.locale, {type: 'ordinal'});
	}
	return rules.select(value);
};

const number = (ctx, value, style) => {
	let formatter = ctx.number[style];
	if (!formatter) {
		ctx.number[style] = formatter = new Intl.NumberFormat(ctx.locale, {style});
	}
	return formatter.format(value);
};

const date = (ctx, value, dateStyle = 'medium') => {
	let formatter = ctx.date[dateStyle];
	if (!formatter) {
		ctx.date[dateStyle] = formatter = new Intl.DateTimeFormat(ctx.locale, {dateStyle});
	}
	return formatter.format(value);
};

const time = (ctx, value, timeStyle = 'medium') => {
	let formatter = ctx.time[timeStyle];
	if (!formatter) {
		ctx.time[timeStyle] = formatter = new Intl.DateTimeFormat(ctx.locale, {timeStyle});
	}
	return formatter.format(value);
};

const pick = (options) => options.find((o) => o !== undefined);

const handlers = {
	[ARGUMENT]: (ctx, value) => value,
	[SELECT]: (ctx, value, choices, values) => process(ctx, pick([choices[value], choices.other]), values),
	[CARDINAL]: (ctx, value, {offset = 0, ...choices}, values) =>
		process(ctx, pick([choices[value], choices[cardinal(ctx, value - offset)], choices.other]), values, value - offset),
	[ORDINAL]: (ctx, value, {offset = 0, ...choices}, values) =>
		process(ctx, pick([choices[value], choices[ordinal(ctx, value - offset)], choices.other]), values, value - offset),
	[NUMBER]: number,
	[DATE]: date,
	[TIME]: time,
};

const process = (ctx, message, values, pluralValue) =>
	typeof message === 'string'
		? message
		: message.reduce((result, token) => {
				if (typeof token === 'string') return result + token;

				const [type, name, data] = token;
				return (
					result + (type === OCTOTHORPE ? number(ctx, pluralValue) : handlers[type](ctx, values[name], data, values))
				);
		  }, '');

export default ([locale, messages]) => {
	const ctx = {locale, number: {}, date: {}, time: {}};
	return (key, values) => {
		const message = messages[key];
		return message ? process(ctx, message, values) : key;
	};
};
