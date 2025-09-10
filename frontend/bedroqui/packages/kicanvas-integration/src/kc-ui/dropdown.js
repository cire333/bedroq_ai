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
import { listen } from "../base/events";
import { attribute, css, html } from "../base/web-components";
import { KCUIElement } from "./element";
/**
 * kc-ui-dropdown is a basic dropdown menu.
 *
 * This can be used for dropdown menus or for context menus.
 *
 * It also makes sure not to immediately close the menu when the user mouses
 * out, instead relying on a buffer zone.
 */
export class KCUIDropdownElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            :host {
                border-radius: 5px;
                border: 1px solid transparent;
                display: none;
                flex-direction: column;
                overflow: hidden;
                user-select: none;
                background: var(--dropdown-bg);
                color: var(--dropdown-fg);
                font-weight: 300;
            }

            :host([visible]) {
                display: flex;
            }
        `,
    ]; }
    constructor() {
        super();
        this.mouseout_padding ??= 50;
    }
    show() {
        if (this.visible) {
            return;
        }
        this.visible = true;
        this.dispatchEvent(new CustomEvent("kc-ui-dropdown:show", {
            bubbles: true,
            composed: true,
        }));
    }
    hide() {
        if (!this.visible) {
            return;
        }
        this.visible = false;
        this.dispatchEvent(new CustomEvent("kc-ui-dropdown:hide", {
            bubbles: true,
            composed: true,
        }));
    }
    toggle() {
        if (this.visible) {
            this.hide();
        }
        else {
            this.show();
        }
    }
    get menu() {
        return this.querySelector("kc-ui-menu");
    }
    initialContentCallback() {
        super.initialContentCallback();
        if (this.hasAttribute("auto-hide")) {
            this.setup_leave_event();
        }
        this.menu.classList.add("invert-scrollbar");
    }
    setup_leave_event() {
        // Handles closing the panel when the mouse is well outside of the
        // bounding box.
        this.addEventListener("mouseleave", (e) => {
            if (!this.visible) {
                return;
            }
            const padding = this.mouseout_padding;
            const rect = this.getBoundingClientRect();
            const move_listener = listen(window, "mousemove", (e) => {
                if (!this.visible) {
                    move_listener.dispose();
                }
                const in_box = e.clientX > rect.left - padding &&
                    e.clientX < rect.right + padding &&
                    e.clientY > rect.top - padding &&
                    e.clientY < rect.bottom + padding;
                if (!in_box) {
                    this.hide();
                    move_listener.dispose();
                }
            });
        });
    }
    render() {
        return html `<slot></slot>`;
    }
}
__decorate([
    attribute({ type: Boolean })
], KCUIDropdownElement.prototype, "visible", void 0);
__decorate([
    attribute({ type: Number })
], KCUIDropdownElement.prototype, "mouseout_padding", void 0);
window.customElements.define("kc-ui-dropdown", KCUIDropdownElement);
