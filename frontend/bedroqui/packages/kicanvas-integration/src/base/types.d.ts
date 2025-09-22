export type Primitive = null | undefined | boolean | number | string | symbol | bigint;
export declare function is_primitive(value: unknown): value is Primitive;
export declare function is_string(value: unknown): value is string;
export declare function is_number(value: unknown): value is number;
export declare function is_iterable<T>(value: unknown): value is Iterable<T>;
export declare function is_array<T = unknown>(value: unknown): value is T[];
export declare function is_object(value: unknown): value is Object;
export type Constructor<T = unknown> = new (...args: any[]) => T;
