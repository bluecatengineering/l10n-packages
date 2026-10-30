t();
select(1);
select(1, 2);
select(1, {
    a: 'A'
});
plural(1, {
    other: 'x',
    offset: 1
});
plural(1, {
    offset: 'x',
    other: 'x'
});
number();
number(1, 2);
select`x`;
const x = t;
t(...args);
select(1, {
    ...a,
    other: 'x'
});
select(1, {
    [a]: 'A',
    other: 'x'
});
