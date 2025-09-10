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
import { html, query } from "../../../base/web-components";
import { KCUIElement, } from "../../../kc-ui";
export class KCBoardNetsPanelElement extends KCUIElement {
    connectedCallback() {
        (async () => {
            this.viewer = await this.requestLazyContext("viewer");
            await this.viewer.loaded;
            super.connectedCallback();
        })();
    }
    initialContentCallback() {
        this.addEventListener("kc-ui-menu:select", (e) => {
            const item = e.detail;
            const number = parseInt(item?.name, 10);
            if (!number) {
                return;
            }
            this.viewer.highlight_net(number);
        });
        // Wire up search to filter the list
        this.search_input_elm.addEventListener("input", (e) => {
            this.item_filter_elem.filter_text =
                this.search_input_elm.value ?? null;
        });
    }
    render() {
        const board = this.viewer.board;
        const nets = [];
        for (const net of board.nets) {
            nets.push(html `<kc-ui-menu-item
                    name="${net.number}"
                    data-match-text="${net.number} ${net.name}">
                    <span class="very-narrow"> ${net.number} </span>
                    <span>${net.name}</span>
                </kc-ui-menu-item>`);
        }
        return html `
            <kc-ui-panel>
                <kc-ui-panel-title title="Nets"></kc-ui-panel-title>
                <kc-ui-panel-body>
                    <kc-ui-text-filter-input></kc-ui-text-filter-input>
                    <kc-ui-filtered-list>
                        <kc-ui-menu class="outline">${nets}</kc-ui-menu>
                    </kc-ui-filtered-list>
                </kc-ui-panel-body>
            </kc-ui-panel>
        `;
    }
}
__decorate([
    query("kc-ui-text-filter-input", true)
], KCBoardNetsPanelElement.prototype, "search_input_elm", void 0);
__decorate([
    query("kc-ui-filtered-list", true)
], KCBoardNetsPanelElement.prototype, "item_filter_elem", void 0);
window.customElements.define("kc-board-nets-panel", KCBoardNetsPanelElement);
