import { BBox, Vec2 } from "../../base/math";
import { Renderer } from "../../graphics";
import type { BoardTheme } from "../../kicad";
import * as board_items from "../../kicad/board";
import { DocumentViewer } from "../base/document-viewer";
import { LayerSet, ViewLayer } from "./layers";
import { BoardPainter } from "./painter";
export declare class BoardViewer extends DocumentViewer<board_items.KicadPCB, BoardPainter, LayerSet, BoardTheme> {
    get board(): board_items.KicadPCB;
    protected create_renderer(canvas: HTMLCanvasElement): Renderer;
    protected create_painter(): BoardPainter;
    protected create_layer_set(): LayerSet;
    protected get grid_origin(): any;
    protected on_pick(mouse: Vec2, items: Generator<{
        layer: ViewLayer;
        bbox: BBox;
    }, void, unknown>): void;
    select(item: board_items.Footprint | string | BBox | null): void;
    highlight_net(net: number): void;
    private set_layers_opacity;
    set track_opacity(value: number);
    set via_opacity(value: number);
    set zone_opacity(value: number);
    set pad_opacity(value: number);
    set pad_hole_opacity(value: number);
    set grid_opacity(value: number);
    set page_opacity(value: number);
    zoom_to_board(): void;
}
