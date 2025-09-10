import { DeferredPromise } from "../async";
import { type IDisposable } from "../disposable";
import { type CSS } from "./css";
import { html, literal } from "./html";
export { html, literal };
/**
 * Base CustomElement class, provides common helpers and behavior.
 */
export declare class CustomElement extends HTMLElement {
    #private;
    /**
     * Styles added to the shadowRoot, can be a string or list of strings.
     */
    static styles: (CSS | CSSStyleSheet) | (CSS | CSSStyleSheet)[];
    static _constructed_styles: CSSStyleSheet[];
    /**
     * If true, a shadowRoot is created for this element.
     */
    static useShadowRoot: boolean;
    /**
     * Exports nested shadow dom parts
     * https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/exportparts
     */
    static exportparts: string[];
    protected updateComplete: DeferredPromise<boolean>;
    private disposables;
    constructor();
    addDisposable<T extends IDisposable>(item: T): T;
    /**
     * Returns either the shadowRoot or this if useShadowRoot is false.
     */
    get renderRoot(): ShadowRoot | this;
    /**
     * Called when connected to the DOM
     *
     * By default it calls render() to place the initial content to the
     * renderRoot.
     */
    connectedCallback(): void | undefined;
    disconnectedCallback(): void | undefined;
    /**
     * Called after the initial content is added to the renderRoot, perfect
     * for registering event callbacks.
     */
    initialContentCallback(): void | undefined;
    /**
     * Called to render content to the renderRoot.
     */
    render(): Element | DocumentFragment;
    renderedCallback(): void | undefined;
    update(): Promise<boolean>;
    protected queryAssignedElements<T extends Element = HTMLElement>(slot_name?: string, selector?: string): T[];
}
