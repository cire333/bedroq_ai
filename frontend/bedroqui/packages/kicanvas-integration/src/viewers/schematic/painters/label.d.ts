import { Color } from "../../../base/color";
import { Vec2 } from "../../../base/math";
import * as schematic_items from "../../../kicad/schematic";
import { SchText } from "../../../kicad/text";
import { LayerNames, ViewLayer } from "../layers";
import { SchematicItemPainter } from "./base";
/**
 * Implements KiCAD rendering logic for net, global, and hierarchical labels.
 *
 * This is similar in scope to the SymbolPin, EDAText class and its children,
 * it's designed to recreate KiCAD's behavior as closely as possible.
 *
 * This logic is adapted from:
 * - SCH_LABEL_BASE
 * - SCH_LABEL
 * - SCH_PAINTER::draw( const SCH_LABEL )
 * - SCH_PAINTER::draw( const SCH_HIERLABEL )
 * - SCH_PAINTER::draw( const SCH_TEXT )
 *
 */
export declare class LabelPainter extends SchematicItemPainter {
    classes: any[];
    layers_for(item: schematic_items.Label): LayerNames[];
    paint(layer: ViewLayer, l: schematic_items.Label): void;
    create_shape(l: schematic_items.Label, schtext: SchText): Vec2[];
    get color(): Color;
    after_apply(l: schematic_items.Label, schtext: SchText): void;
    get_text_offset(schtext: SchText): number;
    get_box_expansion(schtext: SchText): number;
    /**
     * The offset between the schematic item's position and the actual text
     * position
     *
     * This takes into account orientation and any additional distance to make
     * the text readable (such as offsetting it from the top of a wire).
     */
    get_schematic_text_offset(l: schematic_items.Label, schtext: SchText): Vec2;
}
export declare class NetLabelPainter extends LabelPainter {
    classes: any[];
    get color(): any;
}
export declare class GlobalLabelPainter extends LabelPainter {
    classes: any[];
    get color(): any;
    get_schematic_text_offset(l: schematic_items.Label, schtext: SchText): Vec2;
    /**
     * Creates the label's outline shape
     * Adapted from SCH_GLOBALLABEL::CreateGraphicShape
     */
    create_shape(l: schematic_items.Label, schtext: SchText): Vec2[];
}
export declare class HierarchicalLabelPainter extends LabelPainter {
    classes: any[];
    get color(): any;
    after_apply(l: schematic_items.HierarchicalLabel, schtext: SchText): void;
    get_schematic_text_offset(l: schematic_items.Label, schtext: SchText): Vec2;
    /**
     * Creates the label's outline shape
     * Adapted from SCH_HIERLABEL::CreateGraphicShape and TemplateShape.
     */
    create_shape(label: schematic_items.HierarchicalLabel, schtext: SchText): Vec2[];
}
