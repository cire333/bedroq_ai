import { Color } from "../base/color";
import { type List } from "./tokenizer";
declare enum Kind {
    start = 0,
    positional = 1,
    pair = 2,
    list = 3,
    atom = 4,
    item_list = 5,
    expr = 6
}
type ListOrAtom = number | string | List;
type Obj = Record<string, any>;
type Item = {
    new (e: Parseable, ...args: any[]): any;
};
type TypeProcessor = (obj: Obj, name: string, e: ListOrAtom) => any;
type PropertyDefinition = {
    name: string;
    kind: Kind;
    accepts?: string[];
    fn: TypeProcessor;
};
/**
 * Type processors.
 * They transform an extracted value from the s-expr into the appropriate
 * data type requested by the property definition.
 */
export declare const T: {
    any(obj: Obj, name: string, e: ListOrAtom): any;
    boolean(obj: Obj, name: string, e: ListOrAtom): boolean;
    string(obj: Obj, name: string, e: ListOrAtom): string | undefined;
    number(obj: Obj, name: string, e: ListOrAtom): number | undefined;
    item(type: Item, ...args: any[]): TypeProcessor;
    object(start: any, ...defs: PropertyDefinition[]): TypeProcessor;
    vec2(obj: Obj, name: string, e: ListOrAtom): Vec2;
    color(obj: Obj, name: string, e: ListOrAtom): Color;
};
/**
 * Property definitions
 * These are used to describe the *shape* of the expected data along with the
 * type processor needed to convert it to the right value.
 */
export declare const P: {
    /**
     * Checks that the first item in the list is "name". For example,
     * (thing 1 2 3) would use start("thing").
     */
    start(name: string): PropertyDefinition;
    /**
     * Accepts a positional argument. For example,
     * (1 2 3) with positional("first", T.number) would end up with {first: 1}.
     */
    positional(name: string, typefn?: TypeProcessor): PropertyDefinition;
    /**
     * Accepts a pair. For example, ((a 1)) with pair(a) would end up with {a: 1}.
     */
    pair(name: string, typefn?: TypeProcessor): PropertyDefinition;
    /**
     * Accepts a list. For example ((a 1 2 3)) with list(a) would end up with {a: [1, 2, 3]}.
     */
    list(name: string, typefn?: TypeProcessor): PropertyDefinition;
    /**
     * Accepts a collection. For example ((a 1) (a 2) (a 3)) with collection("items", "a")
     * would end up with {items: [[a, 1], [a, 2], [a, 3]]}.
     */
    collection(name: string, accept: string, typefn?: TypeProcessor): PropertyDefinition;
    /**
     * Like collection but creates a map instead of an array.. For example
     * ((a key1 1) (a key2 2) (a key3 3)) with collection_map("items", "a")
     * would end up with {items: {key1: [a, key1, 2], ...}.
     */
    mapped_collection(name: string, accept: string, keyfn: (obj: any) => string, typefn?: TypeProcessor): PropertyDefinition;
    /**
     * Accepts a dictionary. For example ((thing a 1) (thing b 2) (thing c 3)) with
     * dict("things", "thing") would end up with {things: {a: 1, b: 2, c: 3}}.
     */
    dict(name: string, accept: string, typefn?: TypeProcessor): PropertyDefinition;
    /**
     * Accepts an atom. For example (locked) and ((locked)) with atom("locked")
     * would end up with {locked: true}. Atoms can also be mutually exclusive
     * options, for example atom("align", ["left", "right"]) would process
     * (left) as {align: "left"} and (right) as {align: "right"}.
     */
    atom(name: string, values?: string[]): PropertyDefinition;
    /**
     * Accepts an expression. For example ((thing a 1 b)) with expr("thing")
     * would end up with {thing: ["thing", a, 1, b]}.
     */
    expr(name: string, typefn?: TypeProcessor): PropertyDefinition;
    /**
     * Accepts an expression that describes a simple object with the given
     * property definitions. For example ((thing (a 1) (b 2))) with
     * object("thing", P.pair("a"), P.pair("b")) would end up with
     * {thing: {a: 1, b: 2}}.
     */
    object(name: string, start: any, ...defs: PropertyDefinition[]): PropertyDefinition;
    /**
     * Accepts an expression that describes an object that can be used to
     * construct the given Item type. An Item is any class that takes
     * a List as its first constructor parameter.
     */
    item(name: string, item_type: Item, ...args: any[]): PropertyDefinition;
    /**
     * Accepts an expression that describes a 2d vector. For example,
     * ((xy 1 2)) with vec2("xy") would end up with {xy: Vec2(1, 2)}.
     */
    vec2(name: string): PropertyDefinition;
    color(name?: string): PropertyDefinition;
};
export type Parseable = string | List;
export declare function parse_expr(expr: string | List, ...defs: PropertyDefinition[]): Record<string, any>;
export {};
