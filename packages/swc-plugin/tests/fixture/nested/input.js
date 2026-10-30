import {t, select} from '@bluecateng/l10n.macro';

export const a = (v, items) => t`Items: ${items.map((i) => t`Item ${i}`).join(', ')}`;
export const b = (v) => select(v, {a: t`Tagged ${v}`, other: 'Other'});
