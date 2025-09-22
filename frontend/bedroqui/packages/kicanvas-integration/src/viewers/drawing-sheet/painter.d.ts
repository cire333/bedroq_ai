import { Renderer } from "../../graphics";
import type { BaseTheme } from "../../kicad";
import { DocumentPainter } from "../base/painter";
import { ViewLayer, ViewLayerSet } from "../base/view-layers";
export declare class DrawingSheetPainter extends DocumentPainter {
    constructor(gfx: Renderer, layers: ViewLayerSet, theme: BaseTheme);
    paintable_layers(): Generator<ViewLayer, void, unknown>;
}
