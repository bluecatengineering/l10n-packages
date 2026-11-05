// Fails the publication if any of the executables is missing.
import {accessSync, constants} from 'node:fs';

import {supported} from '../lib/platform.js';

const missing = supported.filter((name) => {
	try {
		accessSync(new URL(`../native/${name}/l10n-cli`, import.meta.url), constants.X_OK);
		return false;
	} catch {
		return true;
	}
});
if (missing.length) {
	console.error(`Missing executables for: ${missing.join(', ')}`);
	process.exitCode = 1;
}
