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
import { later } from "../../base/async";
import { CSS, CustomElement, attribute, css, html, } from "../../base/web-components";
import { KCUIElement } from "../../kc-ui";
import kc_ui_styles from "../../kc-ui/kc-ui.css";
import { Project } from "../project";
import { FetchFileSystem } from "../services/vfs";
/**
 *
 */
class KiCanvasEmbedElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        new CSS(kc_ui_styles),
        css `
            :host {
                margin: 0;
                display: flex;
                position: relative;
                width: 100%;
                max-height: 100%;
                aspect-ratio: 1.414;
                background-color: aqua;
                color: var(--fg);
                font-family: "Nunito", ui-rounded, "Hiragino Maru Gothic ProN",
                    Quicksand, Comfortaa, Manjari, "Arial Rounded MT Bold",
                    Calibri, source-sans-pro, sans-serif;
                contain: layout paint;
            }

            main {
                display: contents;
            }

            kc-board-app,
            kc-schematic-app {
                width: 100%;
                height: 100%;
                flex: 1;
            }
        `,
    ]; }
    constructor() {
        super();
        this.#project = new Project();
        this.custom_resolver = null;
        this.provideContext("project", this.#project);
    }
    #project;
    #schematic_app;
    #board_app;
    initialContentCallback() {
        this.#setup_events();
        later(() => {
            this.#load_src();
        });
    }
    async #setup_events() { }
    async #load_src() {
        const sources = [];
        if (this.src) {
            sources.push(this.src);
        }
        for (const src_elm of this.querySelectorAll("kicanvas-source")) {
            if (src_elm.src) {
                sources.push(src_elm.src);
            }
        }
        if (sources.length == 0) {
            console.warn("No valid sources specified");
            return;
        }
        const vfs = new FetchFileSystem(sources, this.custom_resolver);
        await this.#setup_project(vfs);
    }
    async #setup_project(vfs) {
        this.loaded = false;
        this.loading = true;
        try {
            await this.#project.load(vfs);
            this.loaded = true;
            await this.update();
            this.#project.set_active_page(this.#project.root_schematic_page);
        }
        finally {
            this.loading = false;
        }
    }
    render() {
        if (!this.loaded) {
            return html ``;
        }
        if (this.#project.has_schematics && !this.#schematic_app) {
            this.#schematic_app = html `<kc-schematic-app
                sidebarcollapsed
                controls="${this.controls}"
                controlslist="${this.controlslist}">
            </kc-schematic-app>`;
        }
        if (this.#project.has_boards && !this.#board_app) {
            this.#board_app = html `<kc-board-app
                sidebarcollapsed
                controls="${this.controls}"
                controlslist="${this.controlslist}">
            </kc-board-app>`;
        }
        const focus_overlay = (this.controls ?? "none") == "none" ||
            this.controlslist?.includes("nooverlay")
            ? null
            : html `<kc-ui-focus-overlay></kc-ui-focus-overlay>`;
        return html `<main>
            ${this.#schematic_app} ${this.#board_app} ${focus_overlay}
        </main>`;
    }
}
__decorate([
    attribute({ type: String })
], KiCanvasEmbedElement.prototype, "src", void 0);
__decorate([
    attribute({ type: Boolean })
], KiCanvasEmbedElement.prototype, "loading", void 0);
__decorate([
    attribute({ type: Boolean })
], KiCanvasEmbedElement.prototype, "loaded", void 0);
__decorate([
    attribute({ type: String })
], KiCanvasEmbedElement.prototype, "controls", void 0);
__decorate([
    attribute({ type: String })
], KiCanvasEmbedElement.prototype, "controlslist", void 0);
__decorate([
    attribute({ type: String })
], KiCanvasEmbedElement.prototype, "theme", void 0);
__decorate([
    attribute({ type: String })
], KiCanvasEmbedElement.prototype, "zoom", void 0);
window.customElements.define("kicanvas-embed", KiCanvasEmbedElement);
class KiCanvasSourceElement extends CustomElement {
    constructor() {
        super();
        this.ariaHidden = "true";
        this.hidden = true;
        this.style.display = "none";
    }
}
__decorate([
    attribute({ type: String })
], KiCanvasSourceElement.prototype, "src", void 0);
window.customElements.define("kicanvas-source", KiCanvasSourceElement);
/* Import required fonts.
 * TODO: Package these up as part of KiCanvas
 */
document.body.appendChild(html `<link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0&family=Nunito:wght@300;400;500;600;700&display=swap"
        crossorigin="anonymous" />`);
