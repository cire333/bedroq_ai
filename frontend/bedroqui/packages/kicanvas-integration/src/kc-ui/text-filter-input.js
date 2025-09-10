/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { css, html, query } from "../base/web-components";
import { KCUIElement } from "./element";
export class KCUITextFilterInputElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            :host {
                display: flex;
                align-items: center;
                align-content: center;
                position: relative;
                border-bottom: 1px solid var(--grid-outline);
            }

            kc-ui-icon.before {
                pointer-events: none;
                position: absolute;
                left: 0;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                padding-left: 0.25em;
            }

            input {
                all: unset;
                display: block;
                width: 100%;
                max-width: 100%;
                border-radius: 0;
                padding: 0.4em;
                padding-left: 1.5em;
                text-align: left;
                font: inherit;
                background: var(--input-bg);
                color: var(--input-fg);
            }

            input:placeholder-shown + button {
                display: none;
            }

            button {
                all: unset;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                color: var(--input-fg);
                padding: 0.25em;
            }

            button:hover {
                cursor: pointer;
                color: var(--input-accent);
            }
        `,
    ]; }
    get value() {
        return this.input.value;
    }
    set value(v) {
        this.input.value = v;
        this.input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }
    initialContentCallback() {
        super.initialContentCallback();
        this.button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.value = "";
        });
    }
    render() {
        return html `<kc-ui-icon class="flex before">search</kc-ui-icon>
            <input style="" type="text" placeholder="search" name="search" />
            <button type="button">
                <kc-ui-icon>close</kc-ui-icon>
            </button>`;
    }
}
__decorate([
    query("input", true)
], KCUITextFilterInputElement.prototype, "input", void 0);
__decorate([
    query("button", true)
], KCUITextFilterInputElement.prototype, "button", void 0);
window.customElements.define("kc-ui-text-filter-input", KCUITextFilterInputElement);
