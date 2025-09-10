import { KCUIElement } from "../../../kc-ui";
import { BoardViewer } from "../../../viewers/board/viewer";
export declare class KCBoardInfoPanelElement extends KCUIElement {
    viewer: BoardViewer;
    connectedCallback(): void;
    render(): any;
}
