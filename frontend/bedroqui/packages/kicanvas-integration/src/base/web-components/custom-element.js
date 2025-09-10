/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { as_array } from "../array";
import { DeferredPromise } from "../async";
import { Disposables } from "../disposable";
import { adopt_styles } from "./css";
import { html, literal } from "./html";
export { html, literal };
/**
 * Base CustomElement class, provides common helpers and behavior.
 */
export class CustomElement extends HTMLElement {
    /**
     * If true, a shadowRoot is created for this element.
     */
    static { this.useShadowRoot = true; }
    /**
     * Exports nested shadow dom parts
     * https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/exportparts
     */
    static { this.exportparts = []; }
    constructor() {
        super();
        this.updateComplete = new DeferredPromise();
        this.disposables = new Disposables();
        const static_this = this.constructor;
        if (static_this.exportparts.length) {
            this.setAttribute("exportparts", static_this.exportparts.join(","));
        }
    }
    addDisposable(item) {
        return this.disposables.add(item);
    }
    /**
     * Returns either the shadowRoot or this if useShadowRoot is false.
     */
    get renderRoot() {
        return this.shadowRoot ?? this;
    }
    /**
     * Called when connected to the DOM
     *
     * By default it calls render() to place the initial content to the
     * renderRoot.
     */
    connectedCallback() {
        this.#renderInitialContent();
    }
    disconnectedCallback() {
        this.disposables.dispose();
    }
    /**
     * Called after the initial content is added to the renderRoot, perfect
     * for registering event callbacks.
     */
    initialContentCallback() { }
    /**
     * Called to render content to the renderRoot.
     */
    render() {
        return html ``;
    }
    renderedCallback() { }
    async update() {
        this.updateComplete = new DeferredPromise();
        while (this.renderRoot.firstChild) {
            this.renderRoot.firstChild.remove();
        }
        this.renderRoot.appendChild(await this.render());
        this.renderedCallback();
        window.requestAnimationFrame(() => {
            this.updateComplete.resolve(true);
        });
        return this.updateComplete;
    }
    #renderInitialContent() {
        const static_this = this.constructor;
        this.updateComplete = new DeferredPromise();
        if (this.constructor.useShadowRoot) {
            this.attachShadow({ mode: "open" });
        }
        if (static_this.styles) {
            adopt_styles(this.shadowRoot ?? document, as_array(static_this.styles));
        }
        (async () => {
            const content = this.render();
            this.renderRoot.appendChild(content);
            this.renderedCallback();
            this.initialContentCallback();
            window.requestAnimationFrame(() => {
                this.updateComplete.resolve(true);
            });
        })();
        return this.updateComplete;
    }
    queryAssignedElements(slot_name, selector) {
        const slot_element = this.renderRoot.querySelector(`slot${slot_name ? `[name=${slot_name}]` : ":not([name])"}`);
        const elements = (slot_element?.assignedElements() ?? []);
        if (selector) {
            return elements.filter((elm) => elm.matches(selector));
        }
        else {
            return elements;
        }
    }
}
