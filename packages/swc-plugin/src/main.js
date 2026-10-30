import loadConfig from '@bluecateng/l10n-config';

export default (options) => {
	const {module, hashLength} = loadConfig();
	return ['@bluecateng/l10n-swc-plugin', {module, hashLength, ...options}];
};
