import { Matrix3, Vec2 } from "../../../base/math";
import * as schematic_items from "../../../kicad/schematic";
import { LayerNames, ViewLayer } from "../layers";
import { SchematicItemPainter } from "./base";
export declare class LibSymbolPainter extends SchematicItemPainter {
    #private;
    classes: (typeof schematic_items.LibSymbol)[];
    layers_for(item: schematic_items.LibSymbol): LayerNames[];
    paint(layer: ViewLayer, s: schematic_items.LibSymbol, body_style?: number): void;
}
export declare class SchematicSymbolPainter extends SchematicItemPainter {
    classes: (typeof schematic_items.SchematicSymbol)[];
    layers_for(item: schematic_items.SchematicSymbol): LayerNames[];
    paint(layer: ViewLayer, si: schematic_items.SchematicSymbol): void;
}
export type SymbolTransform = {
    matrix: Matrix3;
    position: Vec2;
    rotations: number;
    mirror_x: boolean;
    mirror_y: boolean;
};
