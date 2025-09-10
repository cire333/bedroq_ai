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
import { css, html, attribute } from "../base/web-components";
import { KCUIElement } from "./element";
/**
 * A toggle menu combines a button and a dropdown into a single element.
 *
 * This element holds a button and a kc-ui-dropdown, the button is used to
 * toggle the dropdown.
 */
export class KCUIToggleMenuElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            * {
                box-sizing: border-box;
            }

            button {
                all: unset;
                box-sizing: border-box;
                user-select: none;
                width: 100%;
                max-width: 100%;
                margin: unset;
                font: inherit;
                padding: 0.3em 0.6em 0.3em 0.6em;
                display: flex;
                align-items: flex-end;
                justify-content: left;
                border: 1px solid transparent;
                border-radius: 0.25em;
                font-weight: 300;
                font-size: 1em;
                background: var(--dropdown-bg);
                color: var(--dropdown-fg);
                transition:
                    color var(--transition-time-medium, 500) ease,
                    background var(--transition-time-medium, 500) ease;
            }

            button:hover {
                background: var(--dropdown-hover-bg);
                color: var(--dropdown-hover-fg);
                box-shadow: none;
                outline: none;
            }

            button kc-ui-icon {
                font-size: 1em;
                margin-top: 0.1em;
                margin-bottom: 0.1em;
            }

            button span {
                display: none;
                margin-left: 0.5em;
            }

            :host([visible]) button {
                border-bottom-left-radius: 0;
                border-bottom-right-radius: 0;
            }

            :host([visible]) button span {
                display: revert;
            }

            ::slotted(kc-ui-dropdown) {
                border-top-left-radius: 0;
                border-top-right-radius: 0;
            }
        `,
    ]; }
    get dropdown() {
        return this.queryAssignedElements("dropdown", "kc-ui-dropdown")[0];
    }
    get button() {
        return this.renderRoot.querySelector("button");
    }
    initialContentCallback() {
        this.button.addEventListener("click", (e) => {
            this.dropdown.toggle();
        });
        this.addEventListener("kc-ui-dropdown:show", () => {
            this.visible = true;
        });
        this.addEventListener("kc-ui-dropdown:hide", () => {
            this.visible = false;
        });
    }
    render() {
        return html `<button name="toggle" type="button" title="${this.title}">
                <kc-ui-icon>${this.icon ?? "question-mark"}</kc-ui-icon>
                <span>${this.title}</span>
            </button>
            <slot name="dropdown"></slot>`;
    }
}
__decorate([
    attribute({ type: String })
], KCUIToggleMenuElement.prototype, "icon", void 0);
__decorate([
    attribute({ type: Boolean })
], KCUIToggleMenuElement.prototype, "visible", void 0);
window.customElements.define("kc-ui-toggle-menu", KCUIToggleMenuElement);
