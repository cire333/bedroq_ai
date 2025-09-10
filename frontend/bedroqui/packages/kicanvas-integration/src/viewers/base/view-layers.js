/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { iterable_as_array } from "../../base/array";
import { BBox } from "../../base/math";
import { Color } from "../../graphics";
/**
 * Common view layer names across all viewers.
 */
export var ViewLayerNames;
(function (ViewLayerNames) {
    ViewLayerNames["overlay"] = ":Overlay";
    ViewLayerNames["drawing_sheet"] = ":DrawingSheet";
    ViewLayerNames["grid"] = ":Grid";
})(ViewLayerNames || (ViewLayerNames = {}));
/**
 * A view layer
 */
export class ViewLayer {
    #visible;
    /**
     * Create a new Layer.
     * @param  ayer_set - the LayerSet that this Layer belongs to
     * @param name - this layer's name
     * @param visible - controls whether the layer is visible when rendering, may be a function returning a boolean.
     */
    constructor(layer_set, name, visible = true, interactive = false, color = Color.white) {
        this.highlighted = false;
        /**
         * True is this layer contains interactive items that are findable via
         * ViewLayerSet.query_point
         */
        this.interactive = false;
        /** A map of board items to bounding boxes
         * A board item can have graphics on multiple layers, the bounding box provided
         * here is only valid for this layer.
         */
        this.bboxes = new Map();
        this.#visible = visible;
        this.layer_set = layer_set;
        this.name = name;
        this.color = color;
        this.interactive = interactive;
        this.items = [];
    }
    dispose() {
        this.clear();
    }
    clear() {
        this.graphics?.dispose();
        this.graphics = undefined;
        this.items = [];
        this.bboxes.clear();
    }
    get visible() {
        if (this.#visible instanceof Function) {
            return this.#visible();
        }
        else {
            return this.#visible;
        }
    }
    set visible(v) {
        this.#visible = v;
    }
    /** The overall bounding box of all items on this layer */
    get bbox() {
        return BBox.combine(this.bboxes.values());
    }
    /** @yields a list of BBoxes that contain the given point */
    *query_point(p) {
        for (const bb of this.bboxes.values()) {
            if (bb.contains_point(p)) {
                yield bb;
            }
        }
    }
}
/**
 * Represents the complete set of view layers.
 */
export class ViewLayerSet {
    #layer_list;
    #layer_map;
    #overlay;
    /**
     * Create a new LayerSet
     */
    constructor() {
        this.#layer_list = [];
        this.#layer_map = new Map();
        this.#overlay = new ViewLayer(this, ViewLayerNames.overlay, true, false, Color.white);
    }
    /**
     * Dispose of any resources held by layers
     */
    dispose() {
        this.#overlay.dispose();
        for (const layer of this.#layer_list) {
            layer.dispose();
        }
        this.#layer_list.length = 0;
        this.#layer_map.clear();
    }
    /**
     * Adds layers to the set. Layers should be added front to back.
     */
    add(...layers) {
        for (const layer of layers) {
            this.#layer_list.push(layer);
            this.#layer_map.set(layer.name, layer);
        }
    }
    /**
     * @yields layers in the order they were added (front to back), does not
     * include the overlay layer.
     */
    *in_order() {
        for (const layer of this.#layer_list) {
            yield layer;
        }
    }
    /**
     * @yields layers in the order they should be drawn (back to front),
     * including the overlay layer.
     */
    *in_display_order() {
        for (let i = this.#layer_list.length - 1; i >= 0; i--) {
            const layer = this.#layer_list[i];
            if (!layer.highlighted) {
                yield layer;
            }
        }
        // Go back through the layers and yield the highlighted ones. These
        // are drawn after regular layers.
        for (let i = this.#layer_list.length - 1; i >= 0; i--) {
            const layer = this.#layer_list[i];
            if (layer.highlighted) {
                yield layer;
            }
        }
        yield this.#overlay;
    }
    /**
     * Gets a Layer by name
     */
    by_name(name) {
        return this.#layer_map.get(name);
    }
    /**
     * Returns all layers that "match" the given pattern.
     */
    *query(predicate) {
        for (const l of this.#layer_list) {
            if (predicate(l)) {
                yield l;
            }
        }
    }
    /**
     * Gets the special overlay layer, which is always visible and always
     * drawn above all others.
     */
    get overlay() {
        return this.#overlay;
    }
    /**
     * Highlights the given layer(s), by default they're drawn above other layers.
     */
    highlight(layer_or_layers) {
        let layer_names = [];
        if (layer_or_layers) {
            layer_names = iterable_as_array(layer_or_layers).map((v) => v instanceof ViewLayer ? v.name : v);
        }
        for (const l of this.#layer_list) {
            if (layer_names.includes(l.name)) {
                l.highlighted = true;
            }
            else {
                l.highlighted = false;
            }
        }
    }
    is_any_layer_highlighted() {
        for (const l of this.#layer_list) {
            if (l.highlighted) {
                return true;
            }
        }
        return false;
    }
    *grid_layers() {
        yield this.by_name(ViewLayerNames.grid);
    }
    /**
     * @yields a list of interactive layers
     */
    *interactive_layers() {
        for (const layer of this.in_order()) {
            if (layer.interactive && layer.visible) {
                yield layer;
            }
        }
    }
    /**
     * @yields layers and bounding boxes that contain the given point.
     */
    *query_point(p) {
        for (const layer of this.interactive_layers()) {
            for (const bbox of layer.query_point(p)) {
                yield { layer, bbox };
            }
        }
    }
    /**
     * @yields bboxes on interactive layers for the given item.
     */
    *query_item_bboxes(item) {
        for (const layer of this.interactive_layers()) {
            const bbox = layer.bboxes.get(item);
            if (bbox) {
                yield bbox;
            }
        }
    }
    /**
     * @return a bounding box encompassing all elements from all layers.
     */
    get bbox() {
        const bboxes = [];
        for (const layer of this.in_order()) {
            bboxes.push(layer.bbox);
        }
        return BBox.combine(bboxes);
    }
}
