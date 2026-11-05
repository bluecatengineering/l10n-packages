# Migration guide

## Native `l10n-cli`

`@bluecateng/l10n-cli` is now a native executable, which extracts the strings and builds the catalogs many times faster, mostly because it no longer needs to start Node and load Babel.

- **Configuration**: only the `"bc-l10n"` object in `package.json` is read. Other configuration files (`.bc-l10nrc`, `.bc-l10nrc.json`, `.bc-l10nrc.yaml`, `bc-l10n.config.js`, etc.) are no longer supported, move their contents to `package.json`.
- **Syntax**: proposals which are not yet part of the language, such as `do` expressions, are reported as syntax errors. JSX is still allowed in `.js`, `.jsx` and `.tsx` files, but not in `.ts` files.
- **Platforms**: the package contains executables for macOS (arm64 and x64) and Linux (arm64 and x64). The Linux executables are statically linked, so they run on any distribution, including the ones which use musl, such as Alpine. Windows is not supported.
- **Install script**: the package has an install script which replaces the `l10n-cli` command with the executable, so it runs without starting Node. If your npm version asks to approve the install scripts of dependencies, run `npm install-scripts approve @bluecateng/l10n-cli`; without the install script the command still works, but it starts Node first. As the install script puts the executable for the current platform in place of the command, `node_modules` must be installed on the platform where the command runs: a `node_modules` installed on macOS and copied or mounted into a Linux container fails with "exec format error", run `npm ci` inside the container instead.
- **Node API**: the package no longer exports the `extract` and `build` functions, use the command line instead.
- **Invalid macro usages**: in addition to the errors reported before, macros used without being called (`const x = t;`) and macros other than `t` used as template tags are reported, as the SWC plugin does. All the errors are now reported at once, with their file, line and column.
- **Nested macros**: macros used inside the arguments of another macro (``select(kind, {a: t`A`, other: 'Other'})``) are now extracted as separate strings, they were previously skipped.
- **Building catalogs**: obsolete entries are no longer included in the compiled catalogs. Messages which could not be displayed are now reported as errors when the catalogs are built: argument types other than `number`, `date` and `time` (such as `spellout`), number and date skeletons (`{n, number, ::currency/USD}`), and select cases repeated in the same message. Errors include the catalog and the message.
- **Catalogs**: the first time a catalog is updated some entries may be reordered. Messages which only differ in case or accents (`"from {0}"` and `"From {0}"`) are now always sorted in the same order, lowercase first, instead of depending on the order in which the files were scanned.

## ESM-only and Babel 8

This covers two breaking changes shipped back-to-back across all `@bluecateng/l10n-*` packages (`ast2icu`, `cli`, `config`, `core`, `icu2obj`, `jest`, `loader`, `macro`) — an ESM-only conversion and a Babel 8 dependency bump. Both land as major version bumps on every affected package. Most consumers need to do nothing beyond upgrading Node and the package versions; the sections below cover the cases where more is needed.

### Packages are now ESM-only

Every package now ships `"type": "module"` with a real `"exports"` field, instead of a CommonJS bundle. There is no CommonJS build.

**Node version.** You need a Node version with `require(esm)` support — `^22.18.0` or `>=24.11.0` (this is also what Babel 8 itself requires, see below). If you only ever consume these packages via `import` in your own source (the normal case — webpack, Vite, and native ESM all handle this natively regardless of your Node version), this doesn't affect you directly, but it does affect anything in your project that runs as a plain Node script (build scripts, codegen, anything invoked with `node some-script.js`).

**If you `require()` one of these packages directly**, its shape changes. A bare `require('@bluecateng/l10n-core')` used to return the module's default export directly. It now returns the ES module namespace object:

```js
// before
const l10nLoad = require('@bluecateng/l10n-core');
l10nLoad(catalog);

// after — either switch to import:
import l10nLoad from '@bluecateng/l10n-core';
l10nLoad(catalog);

// ...or, if you must stay on require(), unwrap .default:
const l10nLoad = require('@bluecateng/l10n-core').default;
l10nLoad(catalog);
```

This is a silent behavior change, not a crash — `require(...)` still succeeds, but calling the result directly as a function (when it's actually `{default: fn}`) throws `TypeError: ... is not a function`. If you have a hand-written script that does `const compile = require('@bluecateng/l10n-icu2obj'); compile(source, 'es')` (this pattern shows up in build/codegen scripts in a few consumer repos), it needs the fix above.

**Nothing else changes for you if you consume these packages through:**

- `import` in your own application/library source (webpack, Vite, any modern bundler) — no change needed.
- `@bluecateng/l10n-loader` as a webpack loader — webpack's `loader-runner` already handles ESM loaders natively.
- `@bluecateng/l10n-jest` as a Jest transformer — Jest resolves ESM transformer modules natively on recent versions.
- `@bluecateng/l10n.macro` via `babel-plugin-macros` — verified working end-to-end with `babel-plugin-macros@3.1.0`+.

**Package layout**: each package's bundled entry point moved from `<package>/index.js` to `<package>/dist/index.js`. This only matters if you were deep-importing an internal path rather than the package name itself (not expected, but worth checking).

### Babel 8

`@bluecateng/l10n-cli` and `@bluecateng/l10n.macro` now depend on Babel 8 internally (`@babel/parser`, `@babel/traverse`, `@babel/helper-module-imports`). **You do not need to upgrade your own project's Babel version to keep using `l10n.macro`** — this was verified directly: `babel-plugin-macros` running under a consumer's own Babel 7 pipeline correctly loads and executes a macro built against Babel 8's `@babel/helper-module-imports`. Babel has kept its core AST format stable across this major version specifically to avoid this kind of breakage.

The only place this matters is the same Node version floor as above (`^22.18.0` or `>=24.11.0`), since it's what lets `l10n-cli` and `l10n.macro` load their own Babel 8 dependencies.

### Checklist

1. Upgrade Node to `^22.18.0` or `>=24.11.0` wherever you run these packages directly (not just in bundled application code).
2. Search your project for any plain `require('@bluecateng/l10n-*')` calls outside of bundled/transpiled source — update them per the example above.
3. Bump the `@bluecateng/l10n-*` packages you depend on to their latest major version.
4. Re-run your build and test suite. If you use `l10n-loader`/`l10n-jest`/`l10n.macro`, no config changes should be needed.

## Getting help

If something doesn't work after following this guide, please open an issue in this repository with your Node version, which package(s) are involved, and how you're consuming them (bundler, Jest, plain Node script, etc.).
