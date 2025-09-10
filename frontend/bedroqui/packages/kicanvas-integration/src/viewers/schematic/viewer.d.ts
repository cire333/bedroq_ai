import { BBox } from "../../base/math";
import { Renderer } from "../../graphics";
import type { SchematicTheme } from "../../kicad";
import { KicadSch, SchematicSheet, SchematicSymbol } from "../../kicad/schematic";
import type { ProjectPage } from "../../kicanvas/project";
import { DocumentViewer } from "../base/document-viewer";
import { LayerSet } from "./layers";
import { SchematicPainter } from "./painter";
export declare class SchematicViewer extends DocumentViewer<KicadSch, SchematicPainter, LayerSet, SchematicTheme> {
    get schematic(): KicadSch;
    create_renderer(canvas: HTMLCanvasElement): Renderer;
    load(src: KicadSch | ProjectPage): Promise<void>;
    protected create_painter(): SchematicPainter;
    protected create_layer_set(): LayerSet;
    select(item: SchematicSymbol | SchematicSheet | string | BBox | null): void;
}
