import { KCUIElement } from "../../../kc-ui";
import { BoardViewer } from "../../../viewers/board/viewer";
export declare class KCBoardObjectsPanelElement extends KCUIElement {
    viewer: BoardViewer;
    connectedCallback(): void;
    private setup_events;
    render(): any;
}
