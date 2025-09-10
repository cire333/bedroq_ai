import { Renderer } from "../../graphics";
import type { SchematicTheme } from "../../kicad";
import { LayerSet } from "./layers";
import { BaseSchematicPainter } from "./painters/base";
export declare class SchematicPainter extends BaseSchematicPainter {
    theme: SchematicTheme;
    constructor(gfx: Renderer, layers: LayerSet, theme: SchematicTheme);
}
