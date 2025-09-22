import { BBox, Vec2 } from "../../base/math";
import { DrawingSheet, type DrawingSheetDocument, type BaseTheme } from "../../kicad";
import { Grid } from "./grid";
import type { DocumentPainter, PaintableDocument } from "./painter";
import { type ViewLayerSet } from "./view-layers";
import { Viewer } from "./viewer";
type ViewableDocument = DrawingSheetDocument & PaintableDocument & {
    filename: string;
};
export declare abstract class DocumentViewer<DocumentT extends ViewableDocument, PainterT extends DocumentPainter, ViewLayerSetT extends ViewLayerSet, ThemeT extends BaseTheme> extends Viewer {
    document: DocumentT;
    drawing_sheet: DrawingSheet;
    layers: ViewLayerSetT;
    theme: ThemeT;
    protected painter: PainterT;
    protected grid: Grid;
    constructor(canvas: HTMLCanvasElement, interactive: boolean, theme: ThemeT);
    protected abstract create_painter(): PainterT;
    protected abstract create_layer_set(): ViewLayerSetT;
    protected get grid_origin(): Vec2;
    load(src: DocumentT): Promise<void>;
    paint(): void;
    zoom_to_page(): void;
    draw(): void;
    select(item: BBox | null): void;
}
export {};
