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
 * kc-ui-range is a wrapper around <input type="range">
 */
export class KCUIRangeElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            :host {
                display: block;
                width: 100%;
                user-select: none;
            }

            input[type="range"] {
                all: unset;
                box-sizing: border-box;
                display: block;
                width: 100%;
                max-width: 100%;
                padding-top: 0.25em;
                padding-bottom: 0.25em;
                -webkit-appearance: none;
                appearance: none;
                font: inherit;
                cursor: grab;
                background: transparent;
                transition:
                    color var(--transition-time-medium) ease,
                    box-shadow var(--transition-time-medium) ease,
                    outline var(--transition-time-medium) ease,
                    background var(--transition-time-medium) ease,
                    border var(--transition-time-medium) ease;
            }

            input[type="range"]:hover {
                z-index: 10;
                box-shadow: var(--input-range-hover-shadow);
            }

            input[type="range"]:focus {
                box-shadow: none;
                outline: none;
            }

            input[type="range"]:disabled:hover {
                cursor: unset;
            }

            input[type="range"]::-webkit-slider-runnable-track {
                box-sizing: border-box;
                height: 0.5em;
                border: 1px solid transparent;
                border-radius: 0.5em;
                background: var(--input-range-bg);
            }
            input[type="range"]::-moz-range-track {
                box-sizing: border-box;
                height: 0.5em;
                border: 1px solid transparent;
                border-radius: 0.5em;
                background: var(--input-range-bg);
            }

            input[type="range"]:hover::-webkit-slider-runnable-track,
            input[type="range"]:focus::-webkit-slider-runnable-track {
                border: 1px solid var(--input-range-hover-bg);
            }
            input[type="range"]:hover::-moz-range-track,
            input[type="range"]:focus::-moz-range-track {
                border: 1px solid var(--input-range-hover-bg);
            }

            input[type="range"]:disabled::-webkit-slider-runnable-track {
                background: var(--input-range-disabled-bg);
            }
            input[type="range"]:disabled::-moz-range-track {
                background: var(--input-range-disabled-bg);
            }

            input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                height: 1em;
                width: 1em;
                border-radius: 0.5em;
                margin-top: -0.3em;
                background: var(--input-range-fg);
            }
            input[type="range"]::-moz-range-thumb {
                border: none;
                height: 1em;
                width: 1em;
                border-radius: 100%;
                margin-top: -0.3em;
                background: var(--input-range-fg);
            }

            input[type="range"]:focus::-webkit-slider-thumb {
                box-shadow: var(--input-range-handle-shadow);
            }
            input[type="range"]:focus::-moz-range-thumb {
                box-shadow: var(--input-range-handle-shadow);
            }
        `,
    ]; }
    static get observedAttributes() {
        return ["disabled", "min", "max", "step", "value"];
    }
    get value() {
        return this.input.value;
    }
    set value(val) {
        this.input.value = val;
    }
    get valueAsNumber() {
        return this.input.valueAsNumber;
    }
    attributeChangedCallback(name, old, value) {
        if (!this.input) {
            return;
        }
        switch (name) {
            case "disabled":
                this.input.disabled = value == null ? false : true;
                break;
            case "min":
                this.input.min = value ?? "";
                break;
            case "max":
                this.input.max = value ?? "";
                break;
            case "step":
                this.input.step = value ?? "";
                break;
            case "value":
                this.value = value ?? "";
                break;
        }
    }
    initialContentCallback() {
        this.input.disabled = this.disabled;
        this.input.addEventListener("input", (e) => {
            e.stopPropagation();
            this.dispatchEvent(new CustomEvent("kc-ui-range:input", {
                composed: true,
                bubbles: true,
            }));
        });
    }
    render() {
        return html `<input
            type="range"
            min="${this.min}"
            max="${this.max}"
            step="${this.step}"
            value="${this.getAttribute("value")}">
        </input>`;
    }
}
__decorate([
    attribute({ type: String })
], KCUIRangeElement.prototype, "name", void 0);
__decorate([
    attribute({ type: String })
], KCUIRangeElement.prototype, "min", void 0);
__decorate([
    attribute({ type: String })
], KCUIRangeElement.prototype, "max", void 0);
__decorate([
    attribute({ type: String })
], KCUIRangeElement.prototype, "step", void 0);
__decorate([
    attribute({ type: Boolean })
], KCUIRangeElement.prototype, "disabled", void 0);
__decorate([
    query("input", true)
], KCUIRangeElement.prototype, "input", void 0);
window.customElements.define("kc-ui-range", KCUIRangeElement);
