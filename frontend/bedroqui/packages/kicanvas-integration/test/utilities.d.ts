type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends Array<infer I> ? Array<DeepPartial<I>> : DeepPartial<T[P]>;
};
export declare function assert_deep_partial<T>(actual: T, expected: DeepPartial<T>, assertfn?: any, path?: string): void;
export {};
