import { KCViewerAppElement } from "../common/app";
import { KCSchematicViewerElement } from "./viewer";
import "./info-panel";
import "./properties-panel";
import "./symbols-panel";
import "./viewer";
import type { ProjectPage } from "../../project";
/**
 * Internal "parent" element for KiCanvas's schematic viewer. Handles
 * setting up the schematic viewer as well as interface controls. It's
 * basically KiCanvas's version of EESchema.
 */
export declare class KCSchematicAppElement extends KCViewerAppElement<KCSchematicViewerElement> {
    on_viewer_select(item?: unknown, previous?: unknown): void;
    can_load(src: ProjectPage): boolean;
    make_viewer_element(): KCSchematicViewerElement;
    make_activities(): any[];
}
