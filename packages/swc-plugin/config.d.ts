export interface L10nSwcPluginOptions {
	/** Path to the l10n module, relative paths are resolved from the current directory of the process. */
	module: string;
	/** The length of the hash used as message key, if not set the ICU string is used as key. */
	hashLength?: number;
}

/**
 * Returns the entry for `jsc.experimental.plugins` using the l10n configuration.
 * @param options options which override the values from the l10n configuration.
 */
export default function l10nSwcPlugin(
	options?: Partial<L10nSwcPluginOptions>
): ['@bluecateng/l10n-swc-plugin', L10nSwcPluginOptions];
