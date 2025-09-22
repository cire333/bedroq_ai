/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { is_array, is_iterable } from "./types";
export function as_array(x) {
    if (is_array(x)) {
        return x;
    }
    return [x];
}
export function iterable_as_array(x) {
    if (is_array(x)) {
        return x;
    }
    if (is_iterable(x)) {
        return Array.from(x);
    }
    return [x];
}
const collator = new Intl.Collator(undefined, { numeric: true });
export function sorted_by_numeric_strings(array, getter) {
    return array.slice().sort((a, b) => collator.compare(getter(a), getter(b)));
}
