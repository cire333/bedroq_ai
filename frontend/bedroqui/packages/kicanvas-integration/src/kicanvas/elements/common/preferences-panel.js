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
import { css, html, query } from "../../../base/web-components";
import { KCUIElement } from "../../../kc-ui";
import { Preferences } from "../../preferences";
import themes from "../../themes";
const prefs = Preferences.INSTANCE;
export class KCPreferencesPanel extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        css `
            select {
                box-sizing: border-box;
                display: block;
                width: 100%;
                max-width: 100%;
                margin-top: 0.25em;
                font-family: inherit;
                font-size: inherit;
                font-weight: 300;
                margin-top: 0.25em;
                border-radius: 0.25em;
                text-align: left;
                padding: 0.25em;
                background: var(--input-bg);
                color: var(--input-fg);
                border: var(--input-border);
                transition:
                    color var(--transition-time-medium) ease,
                    box-shadow var(--transition-time-medium) ease,
                    outline var(--transition-time-medium) ease,
                    background var(--transition-time-medium) ease,
                    border var(--transition-time-medium) ease;
            }

            select::after {
                display: block;
                content: "▾";
                color: var(--input-fg);
            }

            select:hover {
                z-index: 10;
                box-shadow: var(--input-hover-shadow);
            }

            select:focus {
                z-index: 10;
                box-shadow: none;
                outline: var(--input-focus-outline);
            }
        `,
    ]; }
    initialContentCallback() {
        this.renderRoot.addEventListener("input", (e) => {
            const target = e.target;
            if (target.name === "theme") {
                prefs.theme = themes.by_name(this.theme_control.value);
            }
            if (target.name === "align-controls-kicad") {
                prefs.alignControlsWithKiCad = target.checked;
            }
            prefs.save();
        });
    }
    render() {
        const theme_options = themes.list().map((v) => {
            return html `<option
                value="${v.name}"
                selected="${prefs.theme.name == v.name}">
                ${v.friendly_name}
            </option>`;
        });
        return html `
            <kc-ui-panel>
                <kc-ui-panel-title title="Preferences"></kc-ui-panel-title>
                <kc-ui-panel-body padded>
                    <kc-ui-control-list>
                        <kc-ui-control>
                            <label>Theme</label>
                            <select name="theme" value="kicad">
                                ${theme_options}
                            </select>
                        </kc-ui-control>
                    </kc-ui-control-list>
                    <kc-ui-control>
                        <label>
                            <input
                                type="checkbox"
                                name="align-controls-kicad"
                                checked="${prefs.alignControlsWithKiCad}" />
                            Align controls with KiCad
                        </label>
                    </kc-ui-control>
                </kc-ui-panel-body>
            </kc-ui-panel>
        `;
    }
}
__decorate([
    query("[name=theme]", true)
], KCPreferencesPanel.prototype, "theme_control", void 0);
window.customElements.define("kc-preferences-panel", KCPreferencesPanel);
