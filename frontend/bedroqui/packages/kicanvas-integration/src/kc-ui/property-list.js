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
export class KCUIPropertyList extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            :host {
                display: grid;
                gap: 1px;
                grid-template-columns: fit-content(50%) 1fr;
                background: var(--grid-outline);
                border-bottom: 1px solid var(--grid-outline);
            }
        `,
    ]; }
    render() {
        return html `<slot></slot>`;
    }
}
window.customElements.define("kc-ui-property-list", KCUIPropertyList);
export class KCUIPropertyListItemElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            :host {
                display: contents;
            }

            span {
                padding: 0.2em;
                background: var(--bg);
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow: hidden;
                user-select: all;
            }

            :host(.label) span:first-child {
                user-select: none;
                grid-column-end: span 2;
                background: var(--panel-subtitle-bg);
                color: var(--panel-subtitle-fg);
            }

            :host(.label) span:last-child {
                display: none;
            }

            ::slotted(*) {
                vertical-align: middle;
            }
        `,
    ]; }
    render() {
        return html `<span title="${this.name}">${this.name}</span
            ><span><slot></slot></span>`;
    }
}
__decorate([
    attribute({ type: String })
], KCUIPropertyListItemElement.prototype, "name", void 0);
window.customElements.define("kc-ui-property-list-item", KCUIPropertyListItemElement);
