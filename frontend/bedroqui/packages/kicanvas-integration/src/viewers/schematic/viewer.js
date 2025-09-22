/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { first } from "../../base/iterator";
import { is_string } from "../../base/types";
import { Canvas2DRenderer } from "../../graphics/canvas2d";
import { KicadSch, SchematicSheet, SchematicSymbol, } from "../../kicad/schematic";
import { DocumentViewer } from "../base/document-viewer";
import { LayerSet } from "./layers";
import { SchematicPainter } from "./painter";
export class SchematicViewer extends DocumentViewer {
    get schematic() {
        return this.document;
    }
    create_renderer(canvas) {
        const renderer = new Canvas2DRenderer(canvas);
        renderer.state.fill = this.theme.note;
        renderer.state.stroke = this.theme.note;
        renderer.state.stroke_width = 0.1524;
        return renderer;
    }
    async load(src) {
        if (src instanceof KicadSch) {
            return await super.load(src);
        }
        this.document = null;
        const doc = src.document;
        doc.update_hierarchical_data(src.sheet_path);
        return await super.load(doc);
    }
    create_painter() {
        return new SchematicPainter(this.renderer, this.layers, this.theme);
    }
    create_layer_set() {
        return new LayerSet(this.theme);
    }
    select(item) {
        // If item is a string, find the symbol by uuid or reference.
        if (is_string(item)) {
            item =
                this.schematic.find_symbol(item) ??
                    this.schematic.find_sheet(item);
        }
        // If it's a symbol or sheet, find the bounding box for it.
        if (item instanceof SchematicSymbol || item instanceof SchematicSheet) {
            const bboxes = this.layers.query_item_bboxes(item);
            item = first(bboxes) ?? null;
        }
        super.select(item);
    }
}
