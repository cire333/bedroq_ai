import { KCUIElement } from "../../../kc-ui";
import { Footprint } from "../../../kicad/board";
import { BoardViewer } from "../../../viewers/board/viewer";
export declare class KCBoardPropertiesPanelElement extends KCUIElement {
    viewer: BoardViewer;
    selected_item?: Footprint;
    connectedCallback(): void;
    private setup_events;
    render(): any;
}
