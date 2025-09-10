import { KCUIElement } from "../../../kc-ui";
import { SchematicSheet, SchematicSymbol } from "../../../kicad/schematic";
import { SchematicViewer } from "../../../viewers/schematic/viewer";
export declare class KCSchematicPropertiesPanelElement extends KCUIElement {
    viewer: SchematicViewer;
    selected_item?: SchematicSymbol | SchematicSheet;
    connectedCallback(): void;
    private setup_events;
    render(): any;
}
