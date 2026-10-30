import {select, plural, selectOrdinal, number} from '@bluecateng/l10n.macro';

export const statusText = (active) => select(active, {true: 'Active', other: 'Inactive'});
export const typeText = (item) => select(item.type, {1: 'One', 'two': 'Two', other: `Other ${item.type}`});
export const peopleCount = (count) =>
	plural(count, {offset: 1, 0: 'nobody', 1: 'you', one: 'you and one other', other: 'you and # other'});
export const place = (number) => selectOrdinal(number, {one: '#st', two: '#nd', few: '#rd', other: '#th'});
export const formatted = (value) => number(value);
export const percent = (o) => number(o.value, 'percent');
export const shorthand = (key, other) => select(key, {a: 'A', other});
export const ordering = (o, x) => select(o.key, {a: `x ${x.y}`, other: 'b'});
