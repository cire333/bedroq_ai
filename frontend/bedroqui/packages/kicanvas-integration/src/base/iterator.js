/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
export function first(iterable) {
    return iterable[Symbol.iterator]().next().value;
}
export function* map(iterable, callback) {
    let n = 0;
    for (const i of iterable) {
        yield callback(i, n);
        n++;
    }
}
export function isEmpty(iterable) {
    for (const _ of iterable) {
        return false;
    }
    return true;
}
export function length(iterable) {
    let n = 0;
    for (const _ of iterable) {
        n++;
    }
    return n;
}
