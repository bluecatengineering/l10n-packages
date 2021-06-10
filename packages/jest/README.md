# `@bluecat/l10n-jest`

Jest preprocessor for po files.

## Installation

```shell
npm i -D @bluecat/l10n-jest
```

## Usage

Add this object to the `jest` configuration. If `babel-jest` is also required it must be explicitly added to the configuration.

```
"transform": {
  "\\.po$": "@bluecat/l10n-jest"
}
```
