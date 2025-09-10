import type { Color } from "../../../base/color";
import type { SchematicTheme } from "../../../kicad";
import * as schematic_items from "../../../kicad/schematic";
import { DocumentPainter, ItemPainter } from "../../base/painter";
import { type ViewLayer } from "../layers";
import type { SchematicPainter } from "../painter";
import type { SymbolTransform } from "./symbol";
export declare abstract class BaseSchematicPainter extends DocumentPainter {
    theme: SchematicTheme;
    current_symbol?: schematic_items.SchematicSymbol;
    current_symbol_transform?: SymbolTransform;
}
export declare abstract class SchematicItemPainter extends ItemPainter {
    view_painter: SchematicPainter;
    get theme(): SchematicTheme;
    protected get is_dimmed(): boolean;
    protected dim_color(color: Color): Color;
    protected dim_if_needed(color: Color): Color;
    protected determine_stroke(layer: ViewLayer, item: schematic_items.GraphicItem): {
        width: number;
        color: null;
    } | {
        width: any;
        color: Color;
    };
    protected determine_fill(layer: ViewLayer, item: schematic_items.GraphicItem): Color | null;
}
