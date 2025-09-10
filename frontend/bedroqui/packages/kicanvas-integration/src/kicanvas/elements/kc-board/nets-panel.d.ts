import { KCUIElement } from "../../../kc-ui";
import { BoardViewer } from "../../../viewers/board/viewer";
export declare class KCBoardNetsPanelElement extends KCUIElement {
    viewer: BoardViewer;
    connectedCallback(): void;
    initialContentCallback(): void;
    private search_input_elm;
    private item_filter_elem;
    render(): any;
}
