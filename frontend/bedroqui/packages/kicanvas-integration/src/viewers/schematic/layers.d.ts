import { ViewLayerSet as BaseLayerSet, ViewLayer } from "../base/view-layers";
import type { SchematicTheme } from "../../kicad";
export { ViewLayer };
export declare enum LayerNames {
    interactive = ":Interactive",
    marks = ":Marks",
    symbol_field = ":Symbol:Field",
    label = ":Label",
    junction = ":Junction",
    wire = ":Wire",
    symbol_foreground = ":Symbol:Foreground",
    notes = ":Notes",
    bitmap = ":Bitmap",
    symbol_pin = ":Symbol:Pin",
    symbol_background = ":Symbol:Background",
    drawing_sheet = 0,
    grid = 0
}
/**
 * Represents the complete set of layers used by a View to draw a schematic.
 *
 * While a schematic doesn't have physical layers like a board, it still has
 * "virtual" layers used to make sure things are drawn in the right order.
 */
export declare class LayerSet extends BaseLayerSet {
    theme: SchematicTheme;
    constructor(theme: SchematicTheme);
    interactive_layers(): Generator<ViewLayer, void, unknown>;
}
