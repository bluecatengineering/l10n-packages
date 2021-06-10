# `@bluecat/l10n.macro`

L10n macros.

## Installation

```shell
npm i -D @bluecat/l10n.macro babel-plugin-macros
```

## Usage

### Babel Configuration

To enable the macros plugin it should be added to the Babel configuration.

```
plugins: [
  "macros"
]
```

### Macro Usage

#### t

Tags a template for localization. Other l10n macros can be shallow nested in the template.

```js
import {t} from '@bluecat/l10n.macro';

console.log(t`Hello world`);

const salute = (name) => t`Hello ${name}`;
```

#### select

Selects a string among the specified choices based on the value of `key`.
The key can be either a string, a number, or a boolean.
The list of choices must include "other" which is selected if none of the others match.

```js
import {select} from '@bluecat/l10n.macro';

const statusText = (active) => select(active, {true: 'Active', other: 'Inactive'});
```

#### plural

Selects a string among the specified choices based on the cardinal form of `key`.
The key must be a number.
The list of choices must include "other" which is selected if none of the others match.
The choice keys can be either numbers, or plural keywords for the target language.
An offset can be specified as the first entry in the choices.

```js
import {plural} from '@bluecat/l10n.macro';

const peopleCount = (count) =>
	plural(count, {offset: 1, 0: 'nobody', 1: 'you', one: 'you and one other', other: 'you and # other'});
```

#### selectOrdinal

Selects a string among the specified choices based on the ordinal form of `key`.
The arguments for this macro must follow the same rules as the `plural` macro.

```js
import {selectOrdinal} from '@bluecat/l10n.macro';

const place = (number) => selectOrdinal(number, {one: '#st', two: '#nd', few: '#rd', other: '#th'});
```

#### number

Formats the specified number using the current locale rules.
The first argument must be a number.
The second argument is optional, if specified must be either `'decimal'` or `'percent'`, the default value is `'decimal'`.

```js
import {t, number} from '@bluecat/l10n.macro';

const interest = (value) => t`The interest is ${number(value, 'percent')}`;
```
