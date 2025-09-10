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
import { DropTarget } from "../../base/dom/drag-drop";
import { CSS, attribute, html, query } from "../../base/web-components";
import { KCUIElement, KCUIIconElement } from "../../kc-ui";
import { sprites_url } from "../icons/sprites";
import { Project } from "../project";
import { GitHub } from "../services/github";
import { GitHubFileSystem } from "../services/github-vfs";
import { FetchFileSystem } from "../services/vfs";
import kc_ui_styles from "../../kc-ui/kc-ui.css";
import shell_styles from "./kicanvas-shell.css";
import "../icons/sprites";
import "./common/project-panel";
// Setup KCUIIconElement to use icon sprites.
KCUIIconElement.sprites_url = sprites_url;
/**
 * <kc-kicanvas-shell> is the main entrypoint for the standalone KiCanvas
 * application- it's the thing you see when you go to kicanvas.org.
 *
 * The shell is responsible for managing the currently loaded Project and
 * switching between the different viewer apps (<kc-schematic-app>,
 * <kc-board-app>).
 *
 * This is a simplified version of the subtree:
 *
 * <kc-kicanvas-shell>
 *   <kc-ui-app>
 *     <kc-project-panel>
 *     <kc-schematic-app>
 *       <kc-schematic-viewer>
 *       <kc-ui-activity-side-bar>
 *     <kc-board-app>
 *       <kc-board-viewer>
 *       <kc-ui-activity-side-bar>
 *
 */
class KiCanvasShellElement extends KCUIElement {
    static { this.styles = [
        ...KCUIElement.styles,
        // TODO: Figure out a better way to handle these two styles.
        new CSS(kc_ui_styles),
        new CSS(shell_styles),
    ]; }
    #schematic_app;
    #board_app;
    constructor() {
        super();
        this.project = new Project();
        this.provideContext("project", this.project);
    }
    initialContentCallback() {
        const url_params = new URLSearchParams(document.location.search);
        const github_paths = url_params.getAll("github");
        later(async () => {
            if (this.src) {
                const vfs = new FetchFileSystem([this.src]);
                await this.setup_project(vfs);
                return;
            }
            if (github_paths.length) {
                const vfs = await GitHubFileSystem.fromURLs(...github_paths);
                await this.setup_project(vfs);
                return;
            }
            new DropTarget(this, async (fs) => {
                await this.setup_project(fs);
            });
        });
        this.link_input.addEventListener("input", async (e) => {
            const link = this.link_input.value;
            if (!GitHub.parse_url(link)) {
                return;
            }
            const vfs = await GitHubFileSystem.fromURLs(link);
            await this.setup_project(vfs);
            const location = new URL(window.location.href);
            location.searchParams.set("github", link);
            window.history.pushState(null, "", location);
        });
    }
    async setup_project(vfs) {
        this.loaded = false;
        this.loading = true;
        try {
            await this.project.load(vfs);
            this.project.set_active_page(this.project.first_page);
            this.loaded = true;
        }
        catch (e) {
            console.error(e);
        }
        finally {
            this.loading = false;
        }
    }
    render() {
        this.#schematic_app = html `
            <kc-schematic-app controls="full"></kc-schematic-app>
        `;
        this.#board_app = html `
            <kc-board-app controls="full"></kc-board-app>
        `;
        return html `
            <kc-ui-app>
                <section class="overlay">
                    <h1>
                        <img src="images/kicanvas.png" />
                        KiCanvas
                    </h1>
                    <p>
                        KiCanvas is an
                        <strong>interactive</strong>
                        ,
                        <strong>browser-based</strong>
                        viewer for KiCAD schematics and boards. You can learn
                        more from the
                        <a href="https://kicanvas.org/home" target="_blank"
                            >docs</a
                        >. It's in
                        <strong>alpha</strong>
                        so please
                        <a
                            href="https://github.com/theacodes/kicanvas/issues/new/choose"
                            target="_blank">
                            report any bugs</a
                        >!
                    </p>
                    <input
                        name="link"
                        type="text"
                        placeholder="Paste a GitHub link..."
                        autofocus />
                    <p>or drag & drop your KiCAD files</p>
                    <p class="note">
                        KiCanvas is
                        <a
                            href="https://github.com/theacodes/kicanvas"
                            target="_blank"
                            >free & open source</a
                        >
                        and supported by
                        <a
                            href="https://github.com/theacodes/kicanvas#special-thanks"
                            >community donations</a
                        >
                        with significant support from
                        <a href="https://partsbox.com/" target="_blank"
                            >PartsBox</a
                        >,
                        <a href="https://blues.io/" target="_blank">Blues</a>,
                        <a href="https://blog.mithis.net/" target="_blank"
                            >Mithro</a
                        >,
                        <a href="https://github.com/jeremysf">Jeremy Gordon</a>,
                        &
                        <a href="https://github.com/jamesneal" target="_blank"
                            >James Neal</a
                        >. KiCanvas runs entirely within your browser, so your
                        files don't ever leave your machine.
                    </p>
                    <p class="github">
                        <a
                            href="https://github.com/theacodes/kicanvas"
                            target="_blank"
                            title="Visit on GitHub">
                            <img src="images/github-mark-white.svg" />
                        </a>
                    </p>
                </section>
                <main>${this.#schematic_app} ${this.#board_app}</main>
            </kc-ui-app>
        `;
    }
}
__decorate([
    attribute({ type: Boolean })
], KiCanvasShellElement.prototype, "loading", void 0);
__decorate([
    attribute({ type: Boolean })
], KiCanvasShellElement.prototype, "loaded", void 0);
__decorate([
    attribute({ type: String })
], KiCanvasShellElement.prototype, "src", void 0);
__decorate([
    query(`input[name="link"]`, true)
], KiCanvasShellElement.prototype, "link_input", void 0);
window.customElements.define("kc-kicanvas-shell", KiCanvasShellElement);
