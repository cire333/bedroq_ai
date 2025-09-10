/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { as_array } from "../base/array";
import { Color } from "../base/color";
import { Vec2 } from "../base/math";
import { Logger } from "../base/log";
import { is_number, is_string } from "../base/types";
import { listify } from "./tokenizer";
const log = new Logger("kicanvas:parser");
var Kind;
(function (Kind) {
    // the first token in the expr (kind ...)
    Kind[Kind["start"] = 0] = "start";
    // (1 2 3) -> {name: value}
    Kind[Kind["positional"] = 1] = "positional";
    // ((name value)) -> {name: value}
    Kind[Kind["pair"] = 2] = "pair";
    // ((name value value value ...)) -> {name: [value, value, value]}
    Kind[Kind["list"] = 3] = "list";
    // (locked [he]) or mutually exclusively flags like (a | b | c)
    Kind[Kind["atom"] = 4] = "atom";
    // (name (kind 1) (kind 2) ...) -> {name: [item1, item2]}
    Kind[Kind["item_list"] = 5] = "item_list";
    // generic expression (name 1 [2 3]) -> {name: [name, 1, [2, 3]]}
    Kind[Kind["expr"] = 6] = "expr";
})(Kind || (Kind = {}));
/**
 * Type processors.
 * They transform an extracted value from the s-expr into the appropriate
 * data type requested by the property definition.
 */
export const T = {
    any(obj, name, e) {
        return e;
    },
    boolean(obj, name, e) {
        switch (e) {
            case "false":
            case "no":
                return false;
            case "true":
            case "yes":
                return true;
            default:
                return e ? true : false;
        }
    },
    string(obj, name, e) {
        if (is_string(e)) {
            return e;
        }
        else {
            return undefined;
        }
    },
    number(obj, name, e) {
        if (is_number(e)) {
            return e;
        }
        else {
            return undefined;
        }
    },
    item(type, ...args) {
        return (obj, name, e) => {
            return new type(e, ...args);
        };
    },
    object(start, ...defs) {
        return (obj, name, e) => {
            let existing = {};
            if (start !== null) {
                existing = obj[name] ?? start ?? {};
            }
            return {
                ...existing,
                ...parse_expr(e, P.start(name), ...defs),
            };
        };
    },
    vec2(obj, name, e) {
        const el = e;
        return new Vec2(el[1], el[2]);
    },
    color(obj, name, e) {
        const el = e;
        return new Color(el[1] / 255, el[2] / 255, el[3] / 255, el[4]);
    },
};
/**
 * Property definitions
 * These are used to describe the *shape* of the expected data along with the
 * type processor needed to convert it to the right value.
 */
export const P = {
    /**
     * Checks that the first item in the list is "name". For example,
     * (thing 1 2 3) would use start("thing").
     */
    start(name) {
        return {
            kind: Kind.start,
            name: name,
            fn: T.string,
        };
    },
    /**
     * Accepts a positional argument. For example,
     * (1 2 3) with positional("first", T.number) would end up with {first: 1}.
     */
    positional(name, typefn = T.any) {
        return {
            kind: Kind.positional,
            name: name,
            fn: typefn,
        };
    },
    /**
     * Accepts a pair. For example, ((a 1)) with pair(a) would end up with {a: 1}.
     */
    pair(name, typefn = T.any) {
        return {
            kind: Kind.pair,
            name: name,
            accepts: [name],
            fn: (obj, name, e) => {
                return typefn(obj, name, e[1]);
            },
        };
    },
    /**
     * Accepts a list. For example ((a 1 2 3)) with list(a) would end up with {a: [1, 2, 3]}.
     */
    list(name, typefn = T.any) {
        return {
            kind: Kind.list,
            name: name,
            accepts: [name],
            fn: (obj, name, e) => {
                return e.slice(1).map((n) => typefn(obj, name, n));
            },
        };
    },
    /**
     * Accepts a collection. For example ((a 1) (a 2) (a 3)) with collection("items", "a")
     * would end up with {items: [[a, 1], [a, 2], [a, 3]]}.
     */
    collection(name, accept, typefn = T.any) {
        return {
            kind: Kind.item_list,
            name: name,
            accepts: [accept],
            fn: (obj, name, e) => {
                const list = obj[name] ?? [];
                list.push(typefn(obj, name, e));
                return list;
            },
        };
    },
    /**
     * Like collection but creates a map instead of an array.. For example
     * ((a key1 1) (a key2 2) (a key3 3)) with collection_map("items", "a")
     * would end up with {items: {key1: [a, key1, 2], ...}.
     */
    mapped_collection(name, accept, keyfn, typefn = T.any) {
        return {
            kind: Kind.item_list,
            name: name,
            accepts: [accept],
            fn: (obj, name, e) => {
                const map = obj[name] ?? new Map();
                const val = typefn(obj, name, e);
                const key = keyfn(val);
                map.set(key, val);
                return map;
            },
        };
    },
    /**
     * Accepts a dictionary. For example ((thing a 1) (thing b 2) (thing c 3)) with
     * dict("things", "thing") would end up with {things: {a: 1, b: 2, c: 3}}.
     */
    dict(name, accept, typefn = T.any) {
        return {
            kind: Kind.item_list,
            name: name,
            accepts: [accept],
            fn: (obj, name, e) => {
                const el = e;
                const rec = obj[name] ?? {};
                rec[el[1]] = typefn(obj, name, el[2]);
                return rec;
            },
        };
    },
    /**
     * Accepts an atom. For example (locked) and ((locked)) with atom("locked")
     * would end up with {locked: true}. Atoms can also be mutually exclusive
     * options, for example atom("align", ["left", "right"]) would process
     * (left) as {align: "left"} and (right) as {align: "right"}.
     */
    atom(name, values) {
        let typefn;
        if (values) {
            typefn = T.string;
        }
        else {
            typefn = T.boolean;
            values = [name];
        }
        return {
            kind: Kind.atom,
            name: name,
            accepts: values,
            fn(obj, name, e) {
                // Handle "(atom)" as "atom".
                if (Array.isArray(e) && e.length == 1) {
                    e = e[0];
                }
                return typefn(obj, name, e);
            },
        };
    },
    /**
     * Accepts an expression. For example ((thing a 1 b)) with expr("thing")
     * would end up with {thing: ["thing", a, 1, b]}.
     */
    expr(name, typefn = T.any) {
        return {
            kind: Kind.expr,
            name: name,
            accepts: [name],
            fn: typefn,
        };
    },
    /**
     * Accepts an expression that describes a simple object with the given
     * property definitions. For example ((thing (a 1) (b 2))) with
     * object("thing", P.pair("a"), P.pair("b")) would end up with
     * {thing: {a: 1, b: 2}}.
     */
    object(name, start, ...defs) {
        return P.expr(name, T.object(start, ...defs));
    },
    /**
     * Accepts an expression that describes an object that can be used to
     * construct the given Item type. An Item is any class that takes
     * a List as its first constructor parameter.
     */
    item(name, item_type, ...args) {
        return P.expr(name, T.item(item_type, ...args));
    },
    /**
     * Accepts an expression that describes a 2d vector. For example,
     * ((xy 1 2)) with vec2("xy") would end up with {xy: Vec2(1, 2)}.
     */
    vec2(name) {
        return P.expr(name, T.vec2);
    },
    color(name = "color") {
        return P.expr(name, T.color);
    },
};
export function parse_expr(expr, ...defs) {
    if (is_string(expr)) {
        log.info(`Parsing expression with ${expr.length} chars`);
        expr = listify(expr);
        if (expr.length == 1 && Array.isArray(expr[0])) {
            expr = expr[0];
        }
    }
    const defs_map = new Map();
    let start_def;
    let n = 0;
    for (const def of defs) {
        if (def.kind == Kind.start) {
            start_def = def;
        }
        else if (def.kind == Kind.positional) {
            defs_map.set(n, def);
            n++;
        }
        else {
            for (const a of def.accepts) {
                defs_map.set(a, def);
            }
        }
    }
    if (start_def) {
        const acceptable_start_strings = as_array(start_def.name);
        const first = expr.at(0);
        if (!acceptable_start_strings.includes(first)) {
            throw new Error(`Expression must start with ${start_def.name} found ${first} in ${expr}`);
        }
        expr = expr.slice(1);
    }
    const out = {};
    n = 0;
    for (const element of expr) {
        let def = null;
        // bare string value can be an atom
        if (is_string(element)) {
            def = defs_map.get(element);
        }
        // If not an atom, a bare string or number can be a positional
        if (!def && (is_string(element) || is_number(element))) {
            def = defs_map.get(n);
            if (!def) {
                log.warn(`no def for bare element ${element} at position ${n} in expression ${expr}`);
                continue;
            }
            n++;
        }
        // list of elements
        if (!def && Array.isArray(element)) {
            def = defs_map.get(element[0]);
        }
        if (!def) {
            log.warn(`No def found for element ${element} in expression ${expr}`);
            continue;
        }
        const value = def.fn(out, def.name, element);
        out[def.name] = value;
    }
    return out;
}
