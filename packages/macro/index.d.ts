export type PluralChoices = {
	offset?: number;
	zero?: string;
	one?: string;
	two?: string;
	few?: string;
	many?: string;
	other?: string;
	[digit: number]: string;
};

export type NumberStyle = 'decimal' | 'percent';

/**
 * Tags a template for localization.
 * @param literals the template literals.
 * @param values the interpolated values.
 */
export function t(literals: TemplateStringsArray, ...values: any[]): string;

/**
 * Selects a string among the specified choices based on the value of `key`.
 * @param key the key for the selection.
 * @param choices the possible choices.
 */
export function select(key: number | string | boolean, choices: Record<string, string>): string;

/**
 * Selects a string among the specified choices based on the cardinal form of `key`.
 * @param key the key for the selection.
 * @param choices the possible choices.
 */
export function plural(key: number, choices: PluralChoices): string;

/**
 * Selects a string among the specified choices based on the ordinal form of `key`.
 * @param key the key for the selection.
 * @param choices the possible choices.
 */
export function selectOrdinal(key: number, choices: PluralChoices): string;

/**
 * Formats the specified number using the current locale rules.
 * @param arg the number to format.
 * @param style the number style.
 */
export function number(arg: number, style?: NumberStyle);
