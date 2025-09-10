/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
/**
 * Wrapper over ResizeObserver that implmenets IDisposable
 */
export class SizeObserver {
    #observer;
    constructor(target, callback) {
        this.target = target;
        this.callback = callback;
        this.#observer = new ResizeObserver(() => {
            this.callback(this.target);
        });
        this.#observer.observe(target);
    }
    dispose() {
        this.#observer?.disconnect();
        this.#observer = undefined;
    }
}
