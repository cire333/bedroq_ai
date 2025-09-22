import { Renderer } from "../../graphics";
import type { BaseTheme } from "../../kicad";
import { ViewLayer, ViewLayerSet } from "./view-layers";
/**
 * Base class for all painters responsible for drawing a view items.
 */
export declare abstract class ItemPainter {
    protected view_painter: DocumentPainter;
    protected gfx: Renderer;
    /**
     * List of item classes this painter can draw
     */
    abstract classes: unknown[];
    constructor(view_painter: DocumentPainter, gfx: Renderer);
    abstract layers_for(item: unknown): string[];
    abstract paint(layer: ViewLayer, item: unknown, ...rest: any[]): void;
    get theme(): BaseTheme;
}
export interface PaintableDocument {
    items(): Generator<unknown, void, void>;
}
/**
 * Base class for painting a complete document, for example, an entire schematic or board.
 */
export declare class DocumentPainter {
    #private;
    gfx: Renderer;
    layers: ViewLayerSet;
    theme: BaseTheme;
    /**
     * Create a ViewPainter.
     */
    constructor(gfx: Renderer, layers: ViewLayerSet, theme: BaseTheme);
    protected set painter_list(painters: ItemPainter[]);
    get painters(): Map<unknown, ItemPainter>;
    paint(document: PaintableDocument): void;
    paintable_layers(): Generator<ViewLayer, void, unknown>;
    paint_layer(layer: ViewLayer): void;
    paint_item(layer: ViewLayer, item: unknown, ...rest: any[]): void;
    painter_for(item: any): ItemPainter | undefined;
    layers_for(item: any): string[];
}
