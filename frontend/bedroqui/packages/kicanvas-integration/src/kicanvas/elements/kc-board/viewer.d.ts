import { BoardViewer } from "../../../viewers/board/viewer";
import { KCViewerElement } from "../common/viewer";
export declare class KCBoardViewerElement extends KCViewerElement<BoardViewer> {
    protected update_theme(): void;
    protected make_viewer(): BoardViewer;
}
