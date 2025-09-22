/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
export function is_primitive(value) {
    return (value === null ||
        (typeof value != "object" && typeof value != "function"));
}
export function is_string(value) {
    return typeof value === "string";
}
export function is_number(value) {
    return typeof value === "number" && !isNaN(value);
}
export function is_iterable(value) {
    return (Array.isArray(value) ||
        typeof value?.[Symbol.iterator] === "function");
}
export function is_array(value) {
    return Array.isArray(value);
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function is_object(value) {
    return (typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof RegExp) &&
        !(value instanceof Date));
}
