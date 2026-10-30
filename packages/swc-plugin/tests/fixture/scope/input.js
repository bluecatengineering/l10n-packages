import {t as tr, select} from '@bluecateng/l10n.macro';

export const a = tr`Aliased`;
export const b = (items) => items.map((t) => t.name);
export const c = (select) => select(1, 2);
export const d = () => {
	const tr = (x) => x;
	return tr`Not a macro`;
};
export const e = (v) => select(v, {other: 'Scoped'});
