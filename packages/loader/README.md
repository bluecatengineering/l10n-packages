# `@bluecat/l10n-loader`

Webpack loader for po files.

## Installation

```shell
npm i -D @bluecat/l10n-loader
```

## Usage

Add this object to the `webpack` configuration.

```
  module: {
    rules: [
      {
        test: /\.po$/,
        loader: '@bluecat/l10n-loader',
      },
    ],
  }
```
