/**
 * A class / object that cleans up its resources when dispose() is called.
 *
 * This is based on:
 * * https://github.com/tc39/proposal-explicit-resource-management
 * * https://github.com/dsherret/using_statement
 * * https://github.dev/microsoft/vscode/blob/main/src/vs/base/common/lifecycle.ts
 */
export interface IDisposable {
    dispose(): void;
}
/**
 * A collection of Disposable items that can be disposed of together.
 */
export declare class Disposables implements IDisposable {
    private _disposables;
    private _is_disposed;
    add<T extends IDisposable>(item: T): T;
    disposeAndRemove<T extends IDisposable>(item: T): void;
    get isDisposed(): boolean;
    dispose(): void;
}
