# `@bluecateng/l10n-loader`

Webpack loader for po files.

Upgrading from an older major version? See the [migration guide](https://github.com/bluecatengineering/l10n-packages/blob/master/MIGRATION.md).

## Installation

```shell
npm i -D @bluecateng/l10n-loader
```

## Usage

Add this object to the `webpack` configuration.

```
  module: {
    rules: [
      {
        test: /\.po$/,
        loader: '@bluecateng/l10n-loader',
      },
    ],
  }
```
