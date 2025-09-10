/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
/**
 * Waits the given number of milliseconds and resolves.
 */
export async function wait(delay) {
    return new Promise((resolve) => {
        window.setTimeout(() => {
            resolve();
        }, delay);
    });
}
/**
 * Schedules a callback to be executed by the event loop.
 *
 * Equivalent to window.setTimeout(..., 0);
 */
export function later(callback) {
    window.setTimeout(() => {
        callback();
    }, 0);
}
/**
 * Schedules a callback to be executed when the browser is idle or
 * when deadline milliseconds have passed.
 */
export function when_idle(callback, deadline = 1000) {
    const token = window.requestIdleCallback(() => {
        callback();
    }, { timeout: deadline });
    return {
        dispose: () => {
            window.cancelIdleCallback(token);
        },
    };
}
/**
 * A promise that can be resolved or rejected imperatively.
 */
export class DeferredPromise {
    #promise;
    #resolve;
    #reject;
    #outcome;
    #value;
    constructor() {
        this.#promise = new Promise((resolve, reject) => {
            this.#resolve = resolve;
            this.#reject = reject;
        });
    }
    get rejected() {
        return this.#outcome === 1 /* DeferredOutcome.Rejected */;
    }
    get resolved() {
        return this.#outcome === 0 /* DeferredOutcome.Resolved */;
    }
    get settled() {
        return !!this.#outcome;
    }
    get value() {
        return this.#value;
    }
    then(onfulfilled, onrejected) {
        return this.#promise.then(onfulfilled, onrejected);
    }
    resolve(value) {
        this.#outcome = 0 /* DeferredOutcome.Resolved */;
        this.#value = value;
        this.#resolve(value);
    }
    reject(error) {
        this.#outcome = 1 /* DeferredOutcome.Rejected */;
        this.#value = error;
        this.#reject(error);
    }
}
/**
 * A "Barrier" for waiting for a task to complete before taking an action.
 */
export class Barrier extends DeferredPromise {
    get isOpen() {
        return this.resolved && this.value === true;
    }
    open() {
        this.resolve(true);
    }
}
