import _l10n from "./l10n";
export const a = (v, items)=>/*#__PURE__*/ _l10n("Items: {0}", {
        0: items.map((i)=>/*#__PURE__*/ _l10n("Item {i}", {
                i
            }) /*l10n: Item {i}*/ ).join(', ')
    }) /*l10n: Items: {0}*/ ;
export const b = (v)=>/*#__PURE__*/ _l10n("{v, select, a {{0}} other {Other}}", {
        v,
        0: /*#__PURE__*/ _l10n("Tagged {v}", {
            v
        }) /*l10n: Tagged {v}*/ 
    }) /*l10n: {v, select, a {{0}} other {Other}}*/ ;
