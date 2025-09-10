import { KCUIElement } from "../../../kc-ui";
import { BoardViewer } from "../../../viewers/board/viewer";
export declare class KCBoardLayersPanelElement extends KCUIElement {
    static styles: any[];
    viewer: BoardViewer;
    private panel_body;
    private get items();
    private presets_menu;
    connectedCallback(): void;
    initialContentCallback(): void;
    private update_item_states;
    render(): any;
}
