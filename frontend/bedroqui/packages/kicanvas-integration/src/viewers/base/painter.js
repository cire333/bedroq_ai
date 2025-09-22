/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { Logger } from "../../base/log";
const log = new Logger("kicanvas:project");
/**
 * Base class for all painters responsible for drawing a view items.
 */
export class ItemPainter {
    constructor(view_painter, gfx) {
        this.view_painter = view_painter;
        this.gfx = gfx;
    }
    get theme() {
        return this.view_painter.theme;
    }
}
/**
 * Base class for painting a complete document, for example, an entire schematic or board.
 */
export class DocumentPainter {
    #painters;
    /**
     * Create a ViewPainter.
     */
    constructor(gfx, layers, theme) {
        this.gfx = gfx;
        this.layers = layers;
        this.theme = theme;
        this.#painters = new Map();
    }
    set painter_list(painters) {
        for (const painter of painters) {
            for (const type of painter.classes) {
                this.#painters.set(type, painter);
            }
        }
    }
    get painters() {
        return this.#painters;
    }
    paint(document) {
        log.debug("Painting");
        log.debug("Sorting paintable items into layers");
        for (const item of document.items()) {
            const painter = this.painter_for(item);
            if (!painter) {
                log.warn(`No painter found for ${item?.constructor.name}`);
                continue;
            }
            for (const layer_name of painter.layers_for(item)) {
                this.layers.by_name(layer_name)?.items.push(item);
            }
        }
        for (const layer of this.paintable_layers()) {
            log.debug(`Painting layer ${layer.name} with ${layer.items.length} items`);
            this.paint_layer(layer);
        }
        log.debug("Painting complete");
    }
    *paintable_layers() {
        yield* this.layers.in_display_order();
    }
    paint_layer(layer) {
        const bboxes = new Map();
        this.gfx.start_layer(layer.name);
        for (const item of layer.items) {
            this.gfx.start_bbox();
            this.paint_item(layer, item);
            const bbox = this.gfx.end_bbox(item);
            bboxes.set(item, bbox);
        }
        layer.graphics = this.gfx.end_layer();
        layer.bboxes = bboxes;
    }
    paint_item(layer, item, ...rest) {
        const painter = this.painter_for(item);
        painter?.paint(layer, item, ...rest);
    }
    painter_for(item) {
        return this.painters.get(item.constructor);
    }
    layers_for(item) {
        return this.painters.get(item.constructor)?.layers_for(item) || [];
    }
}
