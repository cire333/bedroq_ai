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
import { delegate } from "../base/events";
import { no_self_recursion } from "../base/functions";
import { is_string } from "../base/types";
import { attribute, css, html } from "../base/web-components";
import { KCUIElement } from "./element";
/**
 * kc-ui-menu and kc-ui-menu-item encompass a simple menu with selectable items.
 */
export class KCUIMenuElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            :host {
                width 100%;
                display: flex;
                flex-direction: column;
                flex-wrap: nowrap;
                background: var(--list-item-bg);
                color: var(--list-item-fg);
            }

            :host(.outline) ::slotted(kc-ui-menu-item) {
                border-bottom: 1px solid var(--grid-outline);
            }

            :host(.dropdown) {
                --list-item-padding: 0.3em 0.6em;
                --list-item-bg: var(--dropdown-bg);
                --list-item-fg: var(--dropdown-fg);
                --list-item-hover-bg: var(--dropdown-hover-bg);
                --list-item-hover-fg: var(--dropdown-hover-fg);
                --list-item-active-bg: var(--dropdown-active-bg);
                --list-item-active-fg: var(--dropdown-active-fg);
                max-height: 50vh;
                overflow-y: auto;
            }
        `,
    ]; }
    constructor() {
        super();
        this.role = "menu";
    }
    items() {
        return this.querySelectorAll(`kc-ui-menu-item`);
    }
    item_by_name(name) {
        for (const item of this.items()) {
            if (item.name == name) {
                return item;
            }
        }
        return null;
    }
    deselect() {
        for (const item of this.items()) {
            item.selected = false;
        }
    }
    get selected() {
        for (const item of this.items()) {
            if (item.selected) {
                return item;
            }
        }
        return null;
    }
    set selected(element_or_name) {
        let new_selected;
        if (is_string(element_or_name)) {
            new_selected = this.item_by_name(element_or_name);
        }
        else {
            new_selected = element_or_name;
        }
        this.deselect();
        if (!new_selected || !(new_selected instanceof KCUIMenuItemElement)) {
            return;
        }
        new_selected.selected = true;
        this.send_selected_event(new_selected);
    }
    send_selected_event(new_selected) {
        this.dispatchEvent(new CustomEvent("kc-ui-menu:select", {
            detail: new_selected,
            bubbles: true,
            composed: true,
        }));
    }
    initialContentCallback() {
        super.initialContentCallback();
        delegate(this, `kc-ui-menu-item`, "click", (e, source) => {
            if (e.target.tagName == "KC-UI-BUTTON") {
                return;
            }
            e.stopPropagation();
            this.selected = source;
        });
    }
    render() {
        return html `<slot></slot>`;
    }
}
__decorate([
    no_self_recursion
], KCUIMenuElement.prototype, "send_selected_event", null);
window.customElements.define("kc-ui-menu", KCUIMenuElement);
export class KCUIMenuItemElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            :host {
                display: flex;
                align-items: center;
                flex-wrap: nowrap;
                padding: var(--list-item-padding, 0.2em 0.3em);
                user-select: none;
                background: transparent;
                transition:
                    color var(--transition-time-short) ease,
                    background-color var(--transition-time-short) ease;
                cursor: pointer;
            }

            :host(:hover) {
                background: var(--list-item-hover-bg);
                color: var(--list-item-hover-fg);
            }

            :host([selected]) {
                background: var(--list-item-active-bg);
                color: var(--list-item-active-fg);
            }

            :host([disabled]) {
                background: var(--list-item-disabled-bg);
                color: var(--list-item-disabled-fg);
            }

            ::slotted(*) {
                flex: 1 1 100%;
                display: block;
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow: hidden;
            }

            ::slotted(.narrow) {
                max-width: 100px;
            }

            ::slotted(.very-narrow) {
                max-width: 50px;
            }

            kc-ui-icon {
                margin-right: 0.5em;
                margin-left: -0.1em;
            }
        `,
    ]; }
    constructor() {
        super();
        this.role = "menuitem";
    }
    render() {
        const icon = this.icon
            ? html `<kc-ui-icon>${this.icon}</kc-ui-icon>`
            : undefined;
        return html `${icon}<slot></slot>`;
    }
}
__decorate([
    attribute({ type: String })
], KCUIMenuItemElement.prototype, "name", void 0);
__decorate([
    attribute({ type: String })
], KCUIMenuItemElement.prototype, "icon", void 0);
__decorate([
    attribute({ type: Boolean })
], KCUIMenuItemElement.prototype, "selected", void 0);
__decorate([
    attribute({ type: Boolean })
], KCUIMenuItemElement.prototype, "disabled", void 0);
window.customElements.define("kc-ui-menu-item", KCUIMenuItemElement);
export class KCUIMenuLabelElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            :host {
                width: 100%;
                display: flex;
                flex-wrap: nowrap;
                padding: 0.2em 0.3em;
                background: var(--panel-subtitle-bg);
                color: var(--panel-subtitle-fg);
            }
        `,
    ]; }
    render() {
        return html `<slot></slot>`;
    }
}
window.customElements.define("kc-ui-menu-label", KCUIMenuLabelElement);
