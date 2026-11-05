// Builds the executable for the current platform into the native directory, to test the package locally.
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {nativePath} from '../lib/platform.js';

const dir = fileURLToPath(new URL('..', import.meta.url));
execFileSync('cargo', ['build', '--release', '-p', 'l10n-cli'], {cwd: dir, stdio: 'inherit'});
const target = nativePath(dir);
mkdirSync(dirname(target), {recursive: true});
copyFileSync(fileURLToPath(new URL('../../../target/release/l10n-cli', import.meta.url)), target);
console.log(`Copied the executable to ${target}`);
