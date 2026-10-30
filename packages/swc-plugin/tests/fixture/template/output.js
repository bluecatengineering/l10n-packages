import _l10n from "./l10n";
export const a = /*#__PURE__*/ _l10n("Hello world") /*l10n: Hello world*/ ;
export const b = (name)=>/*#__PURE__*/ _l10n("Hello {name}", {
        name
    }) /*l10n: Hello {name}*/ ;
export const c = (name, user)=>/*#__PURE__*/ _l10n("{name} and {name} by {0} at {1}", {
        name,
        0: user.name,
        1: new Date()
    }) /*l10n: {name} and {name} by {0} at {1}*/ ;
export const d = (active, value)=>/*#__PURE__*/ _l10n("Status: {active, select, true {Active} other {Inactive}} ({value, number, percent})", {
        active,
        value
    }) /*l10n: Status: {active, select, true {Active} other {Inactive}} ({value, number, percent})*/ ;
export const e = (name)=>/*#__PURE__*/ _l10n("Bye {name}", {
        name
    }) /*l10n: Bye {name}*/ ;
export const f = /*#__PURE__*/ _l10n("Plain string") /*l10n: Plain string*/ ;
export const g = (x)=>/*#__PURE__*/ _l10n("a string b nested {x} c inner", {
        x
    }) /*l10n: a string b nested {x} c inner*/ ;
