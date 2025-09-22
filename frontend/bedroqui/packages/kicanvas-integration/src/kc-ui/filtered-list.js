/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { later } from "../base/async";
import { css, html } from "../base/web-components";
import { KCUIElement } from "./element";
export class KCUIFilteredListElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            :host {
                display: contents;
            }
        `,
    ]; }
    render() {
        return html `<slot></slot>`;
    }
    #filter_text;
    set filter_text(v) {
        this.#filter_text = v?.toLowerCase() ?? null;
        this.apply_filter();
    }
    get filter_text() {
        return this.#filter_text;
    }
    get item_selector() {
        return this.getAttribute("item-selector") ?? "[data-match-text]";
    }
    *items() {
        for (const parent of this.queryAssignedElements()) {
            yield* parent.querySelectorAll(this.item_selector);
        }
    }
    apply_filter() {
        later(() => {
            for (const el of this.items()) {
                if (this.#filter_text == null ||
                    el.dataset["matchText"]
                        ?.toLowerCase()
                        .includes(this.#filter_text)) {
                    el.style.removeProperty("display");
                }
                else {
                    el.style.display = "none";
                }
            }
        });
    }
}
window.customElements.define("kc-ui-filtered-list", KCUIFilteredListElement);
