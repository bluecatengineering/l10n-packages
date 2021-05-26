#!/usr/bin/env node

const argv = process.argv;
let locale;
let sources;
if (argv[2] === '-l') {
	locale = argv[3];
	sources = argv.slice(4);
} else {
	sources = argv.slice(2);
}

require('./index')(locale, sources);
