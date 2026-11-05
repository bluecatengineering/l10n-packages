import {fileURLToPath} from 'node:url';

import {replaceStub} from './lib/platform.js';

replaceStub(fileURLToPath(new URL('.', import.meta.url)), process.env);
