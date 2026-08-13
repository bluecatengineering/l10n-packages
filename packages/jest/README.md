# `@bluecateng/l10n-jest`

Jest preprocessor for po files.

Upgrading from an older major version? See the [migration guide](https://github.com/bluecatengineering/l10n-packages/blob/master/MIGRATION.md).

## Installation

```shell
npm i -D @bluecateng/l10n-jest
```

## Usage

Add this object to the `jest` configuration. If `babel-jest` is also required it must be explicitly added to the configuration.

```
"transform": {
  "\\.po$": "@bluecateng/l10n-jest"
}
```
