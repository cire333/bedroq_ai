import type { IDisposable } from "./disposable";
/**
 * Waits the given number of milliseconds and resolves.
 */
export declare function wait(delay: number): Promise<void>;
/**
 * Schedules a callback to be executed by the event loop.
 *
 * Equivalent to window.setTimeout(..., 0);
 */
export declare function later(callback: () => unknown): void;
/**
 * Schedules a callback to be executed when the browser is idle or
 * when deadline milliseconds have passed.
 */
export declare function when_idle(callback: () => unknown, deadline?: number): IDisposable;
/**
 * A promise that can be resolved or rejected imperatively.
 */
export declare class DeferredPromise<T> {
    #private;
    constructor();
    get rejected(): boolean;
    get resolved(): boolean;
    get settled(): boolean;
    get value(): Error | T | undefined;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    resolve(value: T): void;
    reject(error: Error): void;
}
/**
 * A "Barrier" for waiting for a task to complete before taking an action.
 */
export declare class Barrier extends DeferredPromise<boolean> {
    get isOpen(): boolean;
    open(): void;
}
