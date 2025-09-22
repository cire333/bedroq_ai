export declare function first<T>(iterable: Iterable<T>): T | undefined;
export type MapCallbackFn<T, U> = (value: T, index: number) => U;
export declare function map<T, U>(iterable: Iterable<T>, callback: MapCallbackFn<T, U>): Generator<U, any, undefined>;
export declare function isEmpty(iterable: Iterable<unknown>): boolean;
export declare function length(iterable: Iterable<unknown>): number;
