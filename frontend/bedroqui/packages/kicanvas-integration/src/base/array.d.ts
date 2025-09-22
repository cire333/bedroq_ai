export declare function as_array<T>(x: T | T[]): T[];
export declare function as_array<T>(x: T | readonly T[]): readonly T[];
export declare function iterable_as_array<T>(x: T | T[] | Iterable<T>): T[];
export declare function sorted_by_numeric_strings<T>(array: T[], getter: (item: T) => string): T[];
