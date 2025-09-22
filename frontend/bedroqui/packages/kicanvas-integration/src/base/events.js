/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
export function listen(target, type, handler, use_capture_or_options) {
    target.addEventListener(type, handler, use_capture_or_options);
    return {
        dispose: () => {
            target.removeEventListener(type, handler, use_capture_or_options);
        },
    };
}
export function delegate(parent, match, type, handler, use_capture_or_options) {
    return listen(parent, type, (e) => {
        const el = e.target.closest(match);
        if (!el) {
            return;
        }
        handler(e, el);
    }, use_capture_or_options);
}
