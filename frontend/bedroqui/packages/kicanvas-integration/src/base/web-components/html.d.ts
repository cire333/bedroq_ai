export type ElementOrFragment = HTMLElement | DocumentFragment;
export declare function is_HTMLElement(v: any): v is HTMLElement;
/**
 * A tagged template literal that generates HTML
 *
 * This is loosely inspired by Lit's html, but vastly simplified for our use
 * case. We don't do any reactivity or automatic updating, so a lot of the
 * code required to synchronize and update DOM elements automatically isn't
 * needed.
 *
 * There are two key properties that this needs to have:
 * - It must limit the location of variable expansion so we can effectively
 *   work against XSS.
 * - Any elements used in the template literal should retain their identity
 *   once placed in the rendered tree.
 */
export declare function html(strings: TemplateStringsArray, ...values: unknown[]): ElementOrFragment;
/**
 * A tagged template literal that allows text to pass through the html
 * literal as-is, before variable interpolation happens.
 */
export declare function literal(strings: TemplateStringsArray, ...values: unknown[]): Literal;
declare class Literal {
    text: string;
    constructor(text: string);
}
export {};
