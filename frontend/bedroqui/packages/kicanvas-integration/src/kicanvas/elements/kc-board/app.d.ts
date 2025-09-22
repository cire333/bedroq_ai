import type { ProjectPage } from "../../project";
import { KCViewerAppElement } from "../common/app";
import { KCBoardViewerElement } from "./viewer";
import "../common/help-panel";
import "../common/preferences-panel";
import "../common/viewer-bottom-toolbar";
import "./footprints-panel";
import "./info-panel";
import "./layers-panel";
import "./nets-panel";
import "./objects-panel";
import "./properties-panel";
import "./viewer";
/**
 * Internal "parent" element for KiCanvas's board viewer. Handles
 * setting up the actual board viewer as well as interface controls. It's
 * basically KiCanvas's version of PCBNew.
 */
export declare class KCBoardAppElement extends KCViewerAppElement<KCBoardViewerElement> {
    on_viewer_select(item?: unknown, previous?: unknown): void;
    can_load(src: ProjectPage): boolean;
    make_viewer_element(): KCBoardViewerElement;
    make_activities(): any[];
}
