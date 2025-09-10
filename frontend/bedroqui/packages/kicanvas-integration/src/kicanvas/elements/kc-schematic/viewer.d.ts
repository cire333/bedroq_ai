import { SchematicViewer } from "../../../viewers/schematic/viewer";
import { KCViewerElement } from "../common/viewer";
export declare class KCSchematicViewerElement extends KCViewerElement<SchematicViewer> {
    protected update_theme(): void;
    protected make_viewer(): SchematicViewer;
}
