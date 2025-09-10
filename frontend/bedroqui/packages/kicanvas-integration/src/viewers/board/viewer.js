/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { Vec2 } from "../../base/math";
import { is_string } from "../../base/types";
import { WebGL2Renderer } from "../../graphics/webgl";
import * as board_items from "../../kicad/board";
import { DocumentViewer } from "../base/document-viewer";
import { LayerNames, LayerSet } from "./layers";
import { BoardPainter } from "./painter";
export class BoardViewer extends DocumentViewer {
    get board() {
        return this.document;
    }
    create_renderer(canvas) {
        const renderer = new WebGL2Renderer(canvas);
        return renderer;
    }
    create_painter() {
        return new BoardPainter(this.renderer, this.layers, this.theme);
    }
    create_layer_set() {
        return new LayerSet(this.board, this.theme);
    }
    get grid_origin() {
        return this.board.setup?.grid_origin ?? new Vec2(0, 0);
    }
    on_pick(mouse, items) {
        let selected = null;
        for (const { layer: _, bbox } of items) {
            if (bbox.context instanceof board_items.Footprint) {
                selected = bbox.context;
                break;
            }
        }
        this.select(selected);
    }
    select(item) {
        // If item is a string, find the footprint by uuid or reference.
        if (is_string(item)) {
            item = this.board.find_footprint(item);
        }
        // If it's a footprint, use the footprint's nominal bounding box.
        if (item instanceof board_items.Footprint) {
            item = item.bbox;
        }
        super.select(item);
    }
    highlight_net(net) {
        this.painter.paint_net(this.board, net);
        this.draw();
    }
    set_layers_opacity(layers, opacity) {
        for (const layer of layers) {
            layer.opacity = opacity;
        }
        this.draw();
    }
    set track_opacity(value) {
        this.set_layers_opacity(this.layers.copper_layers(), value);
    }
    set via_opacity(value) {
        this.set_layers_opacity(this.layers.via_layers(), value);
    }
    set zone_opacity(value) {
        this.set_layers_opacity(this.layers.zone_layers(), value);
    }
    set pad_opacity(value) {
        this.set_layers_opacity(this.layers.pad_layers(), value);
    }
    set pad_hole_opacity(value) {
        this.set_layers_opacity(this.layers.pad_hole_layers(), value);
    }
    set grid_opacity(value) {
        this.set_layers_opacity(this.layers.grid_layers(), value);
    }
    set page_opacity(value) {
        this.layers.by_name(LayerNames.drawing_sheet).opacity = value;
        this.draw();
    }
    zoom_to_board() {
        const edge_cuts = this.layers.by_name(LayerNames.edge_cuts);
        const board_bbox = edge_cuts.bbox;
        this.viewport.camera.bbox = board_bbox.grow(board_bbox.w * 0.1);
    }
}
