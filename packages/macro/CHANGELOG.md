# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.2.0](https://github.com/bluecatengineering/l10n-packages/compare/%40bluecateng%2Fl10n.macro%400.1.10...%40bluecateng%2Fl10n.macro%400.2.0) (2026-08-14)

### ⚠ BREAKING CHANGES

- published packages are now ESM-only; require() of these
  packages needs Node's require(esm) support (Node >=22.12), and the bundled
  entry point moved from index.js to dist/index.js.
- published packages now require Babel 8 where Babel is a
  runtime dependency (packages/cli, packages/macro). Consumers pinning
  @babel/core, @babel/parser, @babel/traverse, or @babel/helper-module-imports
  themselves should upgrade those to ^8 as well.

### Features

- migrate to Babel 8 ([0334c7b](https://github.com/bluecatengineering/l10n-packages/commit/0334c7bde53fd19fe9c41d6ffb6adda3c6ff29e6)), references [babel/babel#13855](https://github.com/babel/babel/issues/13855)
- publish packages as ESM-only, build output under dist/ ([b6d440b](https://github.com/bluecatengineering/l10n-packages/commit/b6d440bd772775f212e8c5d1792acb8864b3c05c))

### Bug Fixes

- resolve ESM-conversion regressions in legacy CJS tooling ([f067434](https://github.com/bluecatengineering/l10n-packages/commit/f0674346b25cc6231a6f4dd2549af139a5f15e6f))

## [0.1.10](https://github.com/bluecatengineering/l10n-packages/compare/@bluecateng/l10n.macro@0.1.9...@bluecateng/l10n.macro@0.1.10) (2026-04-08)

**Note:** Version bump only for package @bluecateng/l10n.macro

## [0.1.9](https://github.com/bluecatengineering/l10n-packages/compare/@bluecateng/l10n.macro@0.1.8...@bluecateng/l10n.macro@0.1.9) (2025-06-03)

**Note:** Version bump only for package @bluecateng/l10n.macro

## [0.1.8](https://github.com/bluecatengineering/l10n-packages/compare/@bluecateng/l10n.macro@0.1.7...@bluecateng/l10n.macro@0.1.8) (2024-04-26)

**Note:** Version bump only for package @bluecateng/l10n.macro

## [0.1.7](https://github.com/bluecatengineering/l10n-packages/compare/@bluecateng/l10n.macro@0.1.6...@bluecateng/l10n.macro@0.1.7) (2023-02-01)

**Note:** Version bump only for package @bluecateng/l10n.macro

## 0.1.6 (2022-09-21)

## [0.1.5](https://gitlab.bluecatlabs.net/bluecat-uiux/l10n-packages/compare/@bluecat/l10n.macro@0.1.4...@bluecat/l10n.macro@0.1.5) (2022-05-06)

### Bug Fixes

- add pure markers to generated calls ([2faf3b3](https://gitlab.bluecatlabs.net/bluecat-uiux/l10n-packages/commit/2faf3b3f1740e1d9443b32589635d3fb87d580c5))

## 0.1.4 (2022-04-27)

### Bug Fixes

- mark all packages as free of side effects ([809f42f](https://gitlab.bluecatlabs.net/bluecat-uiux/l10n-packages/commit/809f42f77e2ce31287cd78f599f2e67154b50a84))

## 0.1.3 (2022-02-14)

## 0.1.2 (2022-01-13)

## 0.1.1 (2021-07-15)

## [0.1.3](https://gitlab.bluecatlabs.net/bluecat-uiux/l10n-packages/compare/v0.1.2...v0.1.3) (2022-02-14)

**Note:** Version bump only for package @bluecat/l10n.macro

## [0.1.2](https://gitlab.bluecatlabs.net/bluecat-uiux/l10n-packages/compare/v0.1.1...v0.1.2) (2022-01-13)

**Note:** Version bump only for package @bluecat/l10n.macro
