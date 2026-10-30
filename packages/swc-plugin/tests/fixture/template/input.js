import {t, select, number} from '@bluecateng/l10n.macro';

export const a = t`Hello world`;
export const b = (name) => t`Hello ${name}`;
export const c = (name, user) => t`${name} and ${name} by ${user.name} at ${new Date()}`;
export const d = (active, value) => t`Status: ${select(active, {true: 'Active', other: 'Inactive'})} (${number(value, 'percent')})`;
export const e = (name) => t(`Bye ${name}`);
export const f = t('Plain string');
export const g = (x) => t`a ${'string'} b ${`nested ${x}`} c ${t('inner')}`;
