/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
/**
 * A collection of Disposable items that can be disposed of together.
 */
export class Disposables {
    constructor() {
        this._disposables = new Set();
        this._is_disposed = false;
    }
    add(item) {
        if (this._is_disposed) {
            throw new Error("Tried to add item to a DisposableStack that's already been disposed");
        }
        this._disposables.add(item);
        return item;
    }
    disposeAndRemove(item) {
        if (!item) {
            return;
        }
        item.dispose();
        this._disposables.delete(item);
    }
    get isDisposed() {
        return this._is_disposed;
    }
    dispose() {
        if (this._is_disposed) {
            console.trace("dispose() called on an already disposed resource");
            return;
        }
        for (const item of this._disposables.values()) {
            item.dispose();
        }
        this._disposables.clear();
        this._is_disposed = true;
    }
}
