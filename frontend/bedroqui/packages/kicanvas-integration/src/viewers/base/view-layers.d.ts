import type { IDisposable } from "../../base/disposable";
import { BBox, Vec2 } from "../../base/math";
import { Color, RenderLayer } from "../../graphics";
/**
 * Common view layer names across all viewers.
 */
export declare enum ViewLayerNames {
    overlay = ":Overlay",
    drawing_sheet = ":DrawingSheet",
    grid = ":Grid"
}
/**
 * View layers
 *
 * KiCanvas's structure uses view layers to gather schematic or board items.
 * These view layers are used render parts of each item in the correct order
 * (back to front) as well as provide bounding box queries.
 *
 * For the board viewer, some layers correspond to physical board layers
 * (like F.Cu, F.SilkS, & so on) but many are "virtual". The schematic viewer
 * uses layers as well but largely to get the correct rendering order.
 */
export type VisibilityType = boolean | (() => boolean);
/**
 * A view layer
 */
export declare class ViewLayer implements IDisposable {
    #private;
    layer_set: ViewLayerSet;
    name: string;
    highlighted: boolean;
    /**
     * The layer color can be used by Painters as a default or fallback color
     * for items.
     */
    color: Color;
    /**
     * The layer opacity is used when rendering the layer.
     */
    opacity: number;
    /**
     * Board or schematic items on this layer.
     */
    items: any[];
    /**
     * This stores all of the graphics created by painters for items on this layer.
     * */
    graphics?: RenderLayer;
    /**
     * True is this layer contains interactive items that are findable via
     * ViewLayerSet.query_point
     */
    interactive: boolean;
    /** A map of board items to bounding boxes
     * A board item can have graphics on multiple layers, the bounding box provided
     * here is only valid for this layer.
     */
    bboxes: Map<any, BBox>;
    /**
     * Create a new Layer.
     * @param  ayer_set - the LayerSet that this Layer belongs to
     * @param name - this layer's name
     * @param visible - controls whether the layer is visible when rendering, may be a function returning a boolean.
     */
    constructor(layer_set: ViewLayerSet, name: string, visible?: VisibilityType, interactive?: boolean, color?: Color);
    dispose(): void;
    clear(): void;
    get visible(): boolean;
    set visible(v: VisibilityType);
    /** The overall bounding box of all items on this layer */
    get bbox(): any;
    /** @yields a list of BBoxes that contain the given point */
    query_point(p: Vec2): Generator<BBox, void, unknown>;
}
/**
 * Represents the complete set of view layers.
 */
export declare class ViewLayerSet implements IDisposable {
    #private;
    /**
     * Create a new LayerSet
     */
    constructor();
    /**
     * Dispose of any resources held by layers
     */
    dispose(): void;
    /**
     * Adds layers to the set. Layers should be added front to back.
     */
    add(...layers: ViewLayer[]): void;
    /**
     * @yields layers in the order they were added (front to back), does not
     * include the overlay layer.
     */
    in_order(): Generator<ViewLayer, void, unknown>;
    /**
     * @yields layers in the order they should be drawn (back to front),
     * including the overlay layer.
     */
    in_display_order(): Generator<ViewLayer, void, unknown>;
    /**
     * Gets a Layer by name
     */
    by_name(name: string): ViewLayer | undefined;
    /**
     * Returns all layers that "match" the given pattern.
     */
    query(predicate: (l: ViewLayer) => boolean): Generator<ViewLayer, void, unknown>;
    /**
     * Gets the special overlay layer, which is always visible and always
     * drawn above all others.
     */
    get overlay(): ViewLayer;
    /**
     * Highlights the given layer(s), by default they're drawn above other layers.
     */
    highlight(layer_or_layers: string | ViewLayer | null | Iterable<string | ViewLayer>): void;
    is_any_layer_highlighted(): boolean;
    grid_layers(): Generator<ViewLayer, void, unknown>;
    /**
     * @yields a list of interactive layers
     */
    interactive_layers(): Generator<ViewLayer, void, unknown>;
    /**
     * @yields layers and bounding boxes that contain the given point.
     */
    query_point(p: Vec2): Generator<{
        layer: ViewLayer;
        bbox: BBox;
    }, void, unknown>;
    /**
     * @yields bboxes on interactive layers for the given item.
     */
    query_item_bboxes(item: any): Generator<any, void, unknown>;
    /**
     * @return a bounding box encompassing all elements from all layers.
     */
    get bbox(): any;
}
