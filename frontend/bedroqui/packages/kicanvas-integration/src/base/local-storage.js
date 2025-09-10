/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
export class LocalStorage {
    constructor(prefix = "kc", reviver) {
        this.prefix = prefix;
        this.reviver = reviver;
    }
    key_for(key) {
        return `${this.prefix}:${key}`;
    }
    set(key, val, exp) {
        window.localStorage.setItem(this.key_for(key), JSON.stringify({
            val: val,
            exp: exp,
        }));
    }
    get(key, fallback) {
        const item_data = window.localStorage.getItem(this.key_for(key));
        if (item_data === null) {
            return fallback;
        }
        const item = JSON.parse(item_data, this.reviver);
        if (item.exp && item.exp < Date.now()) {
            this.delete(key);
            return fallback;
        }
        return item.val;
    }
    delete(key) {
        window.localStorage.removeItem(this.key_for(key));
    }
}
