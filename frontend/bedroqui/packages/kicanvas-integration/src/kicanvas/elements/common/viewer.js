/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { attribute, html } from "../../../base/web-components";
import { KCUIElement } from "../../../kc-ui";
import { KiCanvasLoadEvent } from "../../../viewers/base/events";
import { Preferences, WithPreferences } from "../../preferences";
import themes from "../../themes";
/**
 * Basic element for wiring up a Viewer to the DOM.
 */
export class KCViewerElement extends WithPreferences(KCUIElement) {
    constructor() {
        super(...arguments);
        this.selected = [];
    }
    initialContentCallback() {
        (async () => {
            this.viewer = this.addDisposable(this.make_viewer());
            await this.viewer.setup();
            this.addDisposable(this.viewer.addEventListener(KiCanvasLoadEvent.type, () => {
                this.loaded = true;
                this.dispatchEvent(new KiCanvasLoadEvent());
            }));
        })();
    }
    async preferenceChangeCallback(preferences) {
        // Don't apply preference changes if the theme has been set via an attribute.
        if (this.theme || !this.viewer || !this.viewer.loaded) {
            return;
        }
        this.update_theme();
        this.viewer.paint();
        this.viewer.draw();
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this.selected = [];
    }
    get themeObject() {
        // If the theme attribute is set, override preferences.
        if (this.theme) {
            return themes.by_name(this.theme);
        }
        else {
            return Preferences.INSTANCE.theme;
        }
    }
    async load(src) {
        this.loaded = false;
        await this.viewer.load(src.document);
    }
    render() {
        this.canvas = html `<canvas></canvas>`;
        return html `<style>
                :host {
                    display: block;
                    touch-action: none;
                    width: 100%;
                    height: 100%;
                }

                canvas {
                    width: 100%;
                    height: 100%;
                }
            </style>
            ${this.canvas}`;
    }
}
__decorate([
    attribute({ type: Boolean })
], KCViewerElement.prototype, "loaded", void 0);
__decorate([
    attribute({ type: String })
], KCViewerElement.prototype, "theme", void 0);
__decorate([
    attribute({ type: Boolean })
], KCViewerElement.prototype, "disableinteraction", void 0);
