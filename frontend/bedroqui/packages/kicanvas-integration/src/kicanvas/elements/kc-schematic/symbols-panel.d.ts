import { KCUIElement } from "../../../kc-ui";
import { SchematicViewer } from "../../../viewers/schematic/viewer";
export declare class KCSchematicSymbolsPanelElement extends KCUIElement {
    viewer: SchematicViewer;
    private menu;
    connectedCallback(): void;
    private setup_initial_events;
    renderedCallback(): void;
    private search_input_elm;
    private item_filter_elem;
    render(): any;
}
