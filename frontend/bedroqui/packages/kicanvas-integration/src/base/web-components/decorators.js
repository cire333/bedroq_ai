/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
export function attribute(options) {
    const to = options.converter?.to_attribute ??
        default_attribute_converter.to_attribute;
    const from = options.converter?.from_attribute ??
        default_attribute_converter.from_attribute;
    return (target, propertyKey) => {
        const attributeKey = propertyKey.replace("_", "-");
        let running_on_change = false;
        Object.defineProperty(target, propertyKey, {
            enumerable: true,
            configurable: true,
            get() {
                return from(this.getAttribute(attributeKey), options.type);
            },
            set(value) {
                const old = this[propertyKey];
                const converted = to(value, options.type);
                if (converted === null) {
                    this.removeAttribute(attributeKey);
                }
                else {
                    this.setAttribute(attributeKey, converted);
                }
                if (!running_on_change) {
                    running_on_change = true;
                    options.on_change?.(old, value);
                    running_on_change = false;
                }
            },
        });
    };
}
const default_attribute_converter = {
    to_attribute(value, type) {
        if (value === null) {
            return value;
        }
        switch (type) {
            case Boolean:
                return value ? "" : null;
            case String:
                return value;
            case Number:
                return `${value}`;
            default:
                throw new Error(`Can not convert type "${type}" and value "${value} to attribute`);
        }
    },
    from_attribute(value, type) {
        switch (type) {
            case Boolean:
                return value !== null;
            case String:
                return value;
            case Number:
                return value === null ? null : Number(value);
            default:
                throw new Error(`Can not convert type "${type}" and value "${value} to attribute`);
        }
    },
};
export function query(selector, cache) {
    return (target, propertyKey) => {
        const cache_key = typeof propertyKey === "symbol" ? Symbol() : `__${propertyKey}`;
        Object.defineProperty(target, propertyKey, {
            enumerable: true,
            configurable: true,
            get() {
                const this_as_record = this;
                if (cache && this_as_record[cache_key] !== undefined) {
                    return this_as_record[cache_key];
                }
                const result = this.renderRoot?.querySelector(selector) ?? null;
                if (cache && result) {
                    this_as_record[cache_key] = result;
                }
                return result;
            },
        });
    };
}
export function query_all(selector) {
    return (target, propertyKey) => {
        Object.defineProperty(target, propertyKey, {
            enumerable: true,
            configurable: true,
            get() {
                return this.renderRoot?.querySelectorAll(selector) ?? [];
            },
        });
    };
}
