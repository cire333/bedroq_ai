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
import { attribute, css, html, query } from "../base/web-components";
import { KCUIElement } from "./element";
/**
 * kc-ui-button wraps the <button> element with common styles and behaviors
 */
export class KCUIButtonElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            :host {
                display: inline-flex;
                position: relative;
                width: auto;
                cursor: pointer;
                user-select: none;
                align-items: center;
                justify-content: center;
            }

            button {
                all: unset;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0.5em;
                border: 1px solid transparent;
                border-radius: 0.25em;
                font-weight: medium;
                font-size: 1em;
                background: var(--button-bg);
                color: var(--button-fg);
                transition:
                    color var(--transition-time-short) ease,
                    border var(--transition-time-short) ease,
                    background var(--transition-time-short) ease;
            }

            :host {
                fill: var(--button-fg);
            }

            button:hover {
                background: var(--button-hover-bg);
                color: var(--button-hover-fg);
            }

            button:disabled {
                background: var(--button-disabled-bg);
                color: var(--button-disabled-fg);
            }

            button:focus {
                outline: var(--button-focus-outline);
            }

            :host([selected]) button {
                background: var(--button-selected-bg);
                color: var(--button-selected-fg);
            }

            /* variants */

            button.outline {
                background: var(--button-outline-bg);
                color: var(--button-outline-fg);
            }

            button.outline:hover {
                background: var(--button-outline-hover-bg);
                color: var(--button-outline-hover-fg);
            }

            button.outline:disabled {
                background: var(--button-outline-disabled-bg);
                color: var(--button-outline-disabled-fg);
            }

            :host([selected]) button.outline {
                background: var(--button-outline-disabled-bg);
                color: var(--button--outline-disabled-fg);
            }

            button.toolbar {
                background: var(--button-toolbar-bg);
                color: var(--button-toolbar-fg);
            }

            button.toolbar:hover {
                background: var(--button-toolbar-hover-bg);
                color: var(--button-toolbar-hover-fg);
            }

            button.toolbar:disabled {
                background: var(--button-toolbar-disabled-bg);
                color: var(--button-toolbar-disabled-fg);
            }

            :host([selected]) button.toolbar {
                background: var(--button-toolbar-disabled-bg);
                color: var(--button--toolbar-disabled-fg);
            }

            button.toolbar-alt {
                background: var(--button-toolbar-alt-bg);
                color: var(--button-toolbar-alt-fg);
            }

            button.toolbar-alt:hover {
                background: var(--button-toolbar-alt-hover-bg);
                color: var(--button-toolbar-alt-hover-fg);
            }

            button.toolbar-alt:disabled {
                background: var(--button-toolbar-alt-disabled-bg);
                color: var(--button-toolbar-alt-disabled-fg);
            }

            :host([selected]) button.toolbar-alt {
                background: var(--button-toolbar-alt-disabled-bg);
                color: var(--button--toolbar-alt-disabled-fg);
            }

            button.menu {
                background: var(--button-menu-bg);
                color: var(--button-menu-fg);
                padding: 0;
            }

            button.menu:hover {
                background: var(--button-menu-hover-bg);
                color: var(--button-menu-hover-fg);
                outline: none;
            }

            button.menu:focus {
                outline: none;
            }

            button.menu:disabled {
                background: var(--button-menu-disabled-bg);
                color: var(--button-menu-disabled-fg);
            }

            :host([selected]) button.menu {
                background: var(--button-menu-disabled-bg);
                color: var(--button--menu-disabled-fg);
                outline: none;
            }
        `,
    ]; }
    static get observedAttributes() {
        return ["disabled", "icon"];
    }
    attributeChangedCallback(name, old, value) {
        if (!this.button) {
            return;
        }
        switch (name) {
            case "disabled":
                this.button.disabled = value == null ? false : true;
                break;
            case "icon":
                this.button_icon.innerText = value ?? "";
                break;
        }
    }
    initialContentCallback() {
        if (this.variant) {
            this.button.classList.add(this.variant);
        }
        this.button.disabled = this.disabled;
    }
    render() {
        const icon = this.icon
            ? html `<kc-ui-icon part="icon">${this.icon}</kc-ui-icon>`
            : undefined;
        return html `<button part="base">
            ${icon}
            <slot part="contents"></slot>
        </button>`;
    }
}
__decorate([
    query("button", true)
], KCUIButtonElement.prototype, "button", void 0);
__decorate([
    query("button_icon", true)
], KCUIButtonElement.prototype, "button_icon", void 0);
__decorate([
    attribute({ type: String })
], KCUIButtonElement.prototype, "name", void 0);
__decorate([
    attribute({ type: String })
], KCUIButtonElement.prototype, "icon", void 0);
__decorate([
    attribute({ type: String })
], KCUIButtonElement.prototype, "variant", void 0);
__decorate([
    attribute({ type: Boolean })
], KCUIButtonElement.prototype, "disabled", void 0);
__decorate([
    attribute({ type: Boolean })
], KCUIButtonElement.prototype, "selected", void 0);
window.customElements.define("kc-ui-button", KCUIButtonElement);
