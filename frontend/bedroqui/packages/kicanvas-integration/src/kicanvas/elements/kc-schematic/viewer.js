/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { SchematicViewer } from "../../../viewers/schematic/viewer";
import { KCViewerElement } from "../common/viewer";
export class KCSchematicViewerElement extends KCViewerElement {
    update_theme() {
        this.viewer.theme = this.themeObject.schematic;
    }
    make_viewer() {
        return new SchematicViewer(this.canvas, !this.disableinteraction, this.themeObject.schematic);
    }
}
window.customElements.define("kc-schematic-viewer", KCSchematicViewerElement);
