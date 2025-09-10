import { KCUIElement } from "../../../kc-ui";
import { BoardViewer } from "../../../viewers/board/viewer";
export declare class KCBoardFootprintsPanelElement extends KCUIElement {
    viewer: BoardViewer;
    connectedCallback(): void;
    private menu;
    private sorted_footprints;
    private sort_footprints;
    initialContentCallback(): void;
    private search_input_elm;
    private item_filter_elem;
    render(): any;
    private render_list;
}
