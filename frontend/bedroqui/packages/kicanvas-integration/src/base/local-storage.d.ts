type Reviver = (this: any, key: string, value: any) => any;
export declare class LocalStorage {
    readonly prefix: string;
    readonly reviver?: Reviver | undefined;
    constructor(prefix?: string, reviver?: Reviver | undefined);
    protected key_for(key: string): string;
    set(key: string, val: unknown, exp?: Date): void;
    get<T>(key: string, fallback: T): T;
    delete(key: string): void;
}
export {};
