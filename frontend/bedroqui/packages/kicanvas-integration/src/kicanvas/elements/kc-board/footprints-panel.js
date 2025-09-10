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
import { sorted_by_numeric_strings } from "../../../base/array";
import { html, query } from "../../../base/web-components";
import { KCUIElement, } from "../../../kc-ui";
import { KiCanvasSelectEvent } from "../../../viewers/base/events";
export class KCBoardFootprintsPanelElement extends KCUIElement {
    connectedCallback() {
        (async () => {
            this.viewer = await this.requestLazyContext("viewer");
            await this.viewer.loaded;
            this.sort_footprints();
            super.connectedCallback();
        })();
    }
    sort_footprints() {
        this.sorted_footprints = sorted_by_numeric_strings(this.viewer.board.footprints, (fp) => fp.reference || "REF");
    }
    initialContentCallback() {
        this.addEventListener("kc-ui-menu:select", (e) => {
            const item = e.detail;
            if (!item.name) {
                return;
            }
            this.viewer.select(item.name);
        });
        // Update the selected item in the list whenever the viewer's
        // selection changes.
        this.addDisposable(this.viewer.addEventListener(KiCanvasSelectEvent.type, () => {
            this.menu.selected = this.viewer.selected?.context.uuid ?? null;
        }));
        // Wire up search to filter the list
        this.search_input_elm.addEventListener("input", (e) => {
            this.item_filter_elem.filter_text =
                this.search_input_elm.value ?? null;
        });
    }
    render() {
        return html `
            <kc-ui-panel>
                <kc-ui-panel-title title="Footprints"></kc-ui-panel-title>
                <kc-ui-panel-body>
                    <kc-ui-text-filter-input></kc-ui-text-filter-input>
                    <kc-ui-filtered-list>
                        <kc-ui-menu class="outline">
                            ${this.render_list()}
                        </kc-ui-menu>
                    </kc-ui-filtered-list>
                </kc-ui-panel-body>
            </kc-ui-panel>
        `;
    }
    render_list() {
        const front_footprints = [];
        const back_footprints = [];
        for (const fp of this.sorted_footprints) {
            const ref = fp.reference || "REF";
            const val = fp.value || "VAL";
            const match_text = `${fp.library_link} ${fp.descr} ${fp.layer} ${ref} ${val} ${fp.tags}`;
            const entry = html `<kc-ui-menu-item
                name="${fp.uuid}"
                data-match-text="${match_text}">
                <span class="narrow">${ref}</span><span>${val}</span>
            </kc-ui-menu-item>`;
            if (fp.layer == "F.Cu") {
                front_footprints.push(entry);
            }
            else {
                back_footprints.push(entry);
            }
        }
        return html `<kc-ui-menu-label>Front</kc-ui-menu-label>
            ${front_footprints}
            <kc-ui-menu-label>Back</kc-ui-menu-label>
            ${back_footprints}`;
    }
}
__decorate([
    query("kc-ui-menu", true)
], KCBoardFootprintsPanelElement.prototype, "menu", void 0);
__decorate([
    query("kc-ui-text-filter-input", true)
], KCBoardFootprintsPanelElement.prototype, "search_input_elm", void 0);
__decorate([
    query("kc-ui-filtered-list", true)
], KCBoardFootprintsPanelElement.prototype, "item_filter_elem", void 0);
window.customElements.define("kc-board-footprints-panel", KCBoardFootprintsPanelElement);
