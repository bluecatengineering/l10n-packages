# `@bluecateng/l10n-code`

Core l10n functions.

Upgrading from an older major version? See the [migration guide](https://github.com/bluecatengineering/l10n-packages/blob/master/MIGRATION.md).

## Installation

```shell
npm i @bluecateng/l10n-core
```

## Usage

The module specified in the `module` configuration should contain this code.

```js
import l10nLoad from '@bluecateng/l10n-core';

import en from './en.po';

export default l10nLoad(en);
```
