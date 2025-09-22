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
import { KiCanvasLoadEvent, KiCanvasSelectEvent, } from "../../../viewers/base/events";
export class KCSchematicSymbolsPanelElement extends KCUIElement {
    connectedCallback() {
        (async () => {
            this.viewer = await this.requestLazyContext("viewer");
            await this.viewer.loaded;
            super.connectedCallback();
            this.setup_initial_events();
        })();
    }
    setup_initial_events() {
        let updating_selected = false;
        this.addEventListener("kc-ui-menu:select", (e) => {
            if (updating_selected) {
                return;
            }
            const item = e.detail;
            if (!item.name) {
                return;
            }
            this.viewer.select(item.name);
        });
        // Update the selected item in the list whenever the viewer's
        // selection changes.
        this.addDisposable(this.viewer.addEventListener(KiCanvasSelectEvent.type, () => {
            updating_selected = true;
            this.menu.selected = this.viewer.selected?.context.uuid ?? null;
            updating_selected = false;
        }));
        // Re-render the entire component if a different schematic gets loaded.
        this.addDisposable(this.viewer.addEventListener(KiCanvasLoadEvent.type, () => {
            this.update();
        }));
    }
    renderedCallback() {
        // Wire up search to filter the list
        this.search_input_elm.addEventListener("input", (e) => {
            this.item_filter_elem.filter_text =
                this.search_input_elm.value ?? null;
        });
    }
    render() {
        const schematic = this.viewer.schematic;
        const symbol_elms = [];
        const power_symbol_elms = [];
        const sheet_elms = [];
        const symbols = sorted_by_numeric_strings(Array.from(schematic.symbols.values()), (sym) => sym.reference);
        for (const sym of symbols) {
            const match_text = `${sym.reference} ${sym.value} ${sym.id} ${sym.lib_symbol.name}`;
            const entry = html `<kc-ui-menu-item
                name="${sym.uuid}"
                data-match-text="${match_text}">
                <span class="narrow"> ${sym.reference} </span>
                <span> ${sym.value} </span>
            </kc-ui-menu-item>`;
            if (sym.lib_symbol.power) {
                power_symbol_elms.push(entry);
            }
            else {
                symbol_elms.push(entry);
            }
        }
        const sheets = sorted_by_numeric_strings(schematic.sheets, (sheet) => sheet.sheetname ?? sheet.sheetfile ?? "");
        for (const sheet of sheets) {
            const match_text = `${sheet.sheetname} ${sheet.sheetfile}`;
            sheet_elms.push(html `<kc-ui-menu-item
                    name="${sheet.uuid}"
                    data-match-text="${match_text}">
                    <span class="narrow"> ${sheet.sheetname}</span>
                    <span>${sheet.sheetfile}</span>
                </kc-ui-menu-item>`);
        }
        return html `
            <kc-ui-panel>
                <kc-ui-panel-title title="Symbols"></kc-ui-panel-title>
                <kc-ui-panel-body>
                    <kc-ui-text-filter-input></kc-ui-text-filter-input>
                    <kc-ui-filtered-list>
                        <kc-ui-menu class="outline">
                            ${symbol_elms}
                            ${power_symbol_elms.length
            ? html `<kc-ui-menu-label
                                      >Power symbols</kc-ui-menu-label
                                  >`
            : null}
                            ${power_symbol_elms}
                            ${sheet_elms.length
            ? html `<kc-ui-menu-label
                                      >Sheets</kc-ui-menu-label
                                  >`
            : null}
                            ${sheet_elms}
                        </kc-ui-menu>
                    </kc-ui-filtered-list>
                </kc-ui-panel-body>
            </kc-ui-panel>
        `;
    }
}
__decorate([
    query("kc-ui-menu")
], KCSchematicSymbolsPanelElement.prototype, "menu", void 0);
__decorate([
    query("kc-ui-text-filter-input", true)
], KCSchematicSymbolsPanelElement.prototype, "search_input_elm", void 0);
__decorate([
    query("kc-ui-filtered-list", true)
], KCSchematicSymbolsPanelElement.prototype, "item_filter_elem", void 0);
window.customElements.define("kc-schematic-symbols-panel", KCSchematicSymbolsPanelElement);
