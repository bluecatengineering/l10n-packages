#!/usr/bin/env node

import {extract, build} from './dist/index.js';

const argv = process.argv;
let done;
let clean;
let locale;
let index = 2;
while (!done) {
	const arg = argv[index];
	if (arg === '-c' || arg === '--clean') {
		clean = true;
		++index;
	} else if (arg === '-l' || arg === '--locale') {
		locale = argv[index + 1];
		index += 2;
	} else {
		done = true;
	}
}

if (argv[index] === 'build') {
	build(argv[index + 1]);
} else {
	extract(clean, locale, argv.slice(index));
}
