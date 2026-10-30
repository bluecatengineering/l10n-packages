import _l10n from "./l10n";
export const statusText = (active)=>/*#__PURE__*/ _l10n("{active, select, true {Active} other {Inactive}}", {
        active
    }) /*l10n: {active, select, true {Active} other {Inactive}}*/ ;
export const typeText = (item)=>/*#__PURE__*/ _l10n("{1, select, 1 {One} two {Two} other {Other {0}}}", {
        0: item.type,
        1: item.type
    }) /*l10n: {1, select, 1 {One} two {Two} other {Other {0}}}*/ ;
export const peopleCount = (count)=>/*#__PURE__*/ _l10n("{count, plural, offset:1 =0 {nobody} =1 {you} one {you and one other} other {you and # other}}", {
        count
    }) /*l10n: {count, plural, offset:1 =0 {nobody} =1 {you} one {you and one other} other {you and # other}}*/ ;
export const place = (number)=>/*#__PURE__*/ _l10n("{number, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}", {
        number
    }) /*l10n: {number, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}*/ ;
export const formatted = (value)=>/*#__PURE__*/ _l10n("{value, number}", {
        value
    }) /*l10n: {value, number}*/ ;
export const percent = (o)=>/*#__PURE__*/ _l10n("{0, number, percent}", {
        0: o.value
    }) /*l10n: {0, number, percent}*/ ;
export const shorthand = (key, other)=>/*#__PURE__*/ _l10n("{key, select, a {A} other {{other}}}", {
        other,
        key
    }) /*l10n: {key, select, a {A} other {{other}}}*/ ;
export const ordering = (o, x)=>/*#__PURE__*/ _l10n("{1, select, a {x {0}} other {b}}", {
        0: x.y,
        1: o.key
    }) /*l10n: {1, select, a {x {0}} other {b}}*/ ;
