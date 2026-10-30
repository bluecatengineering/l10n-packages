import _l10n from "./l10n";
export const a = /*#__PURE__*/ _l10n("Aliased") /*l10n: Aliased*/ ;
export const b = (items)=>items.map((t)=>t.name);
export const c = (select)=>select(1, 2);
export const d = ()=>{
    const tr = (x)=>x;
    return tr`Not a macro`;
};
export const e = (v)=>/*#__PURE__*/ _l10n("{v, select, other {Scoped}}", {
        v
    }) /*l10n: {v, select, other {Scoped}}*/ ;
