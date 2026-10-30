import { useState } from 'react';
import { Button } from './Button';
import _l10n from "./l10n";
export default function Component() {
    const [count] = useState(0);
    return <Button title={/*#__PURE__*/ _l10n("Count {count}", {
        count
    }) /*l10n: Count {count}*/ }>{/*#__PURE__*/ _l10n("Click me") /*l10n: Click me*/ }</Button>;
}
