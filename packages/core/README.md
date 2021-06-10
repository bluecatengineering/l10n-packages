# `@bluecat/l10n-code`

Core l10n functions.

## Installation

```shell
npm i @bluecat/l10n-core
```

## Usage

The module specified in the `module` configuration should contain this code.

```js
import l10nLoad from '@bluecat/l10n-core';

import en from './en.po';

export default l10nLoad(en);
```
