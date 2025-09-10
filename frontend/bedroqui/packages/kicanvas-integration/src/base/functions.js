/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
export function no_self_recursion(target, propertyKey, descriptor) {
    const fn = descriptor.value;
    let _is_running = false;
    descriptor.value = function (...args) {
        if (_is_running) {
            return;
        }
        _is_running = true;
        try {
            fn.apply(this, args);
        }
        finally {
            _is_running = false;
        }
    };
}
