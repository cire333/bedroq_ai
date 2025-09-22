/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { BBox, Vec2 } from "../../base/math";
import { Logger } from "../../base/log";
import { DrawingSheet, } from "../../kicad";
import { DrawingSheetPainter } from "../drawing-sheet/painter";
import { Grid } from "./grid";
import { ViewLayerNames } from "./view-layers";
import { Viewer } from "./viewer";
import { later } from "../../base/async";
const log = new Logger("kicanvas:viewer");
export class DocumentViewer extends Viewer {
    constructor(canvas, interactive, theme) {
        super(canvas, interactive);
        this.theme = theme;
    }
    get grid_origin() {
        return new Vec2(0, 0);
    }
    async load(src) {
        await this.setup_finished;
        if (this.document == src) {
            return;
        }
        log.info(`Loading ${src.filename} into viewer`);
        this.document = src;
        this.paint();
        // Wait for a valid viewport size
        later(async () => {
            log.info("Waiting for viewport");
            await this.viewport.ready;
            this.viewport.bounds = this.drawing_sheet.page_bbox.grow(50);
            // Position the camera and draw the scene.
            log.info("Positioning camera");
            this.zoom_to_page();
            // Mark the viewer as loaded and notify event listeners
            this.resolve_loaded(true);
            // Deselect any selected items.
            if (this.selected) {
                this.selected = null;
            }
            // Draw
            this.draw();
        });
    }
    paint() {
        if (!this.document) {
            return;
        }
        // Update the renderer's background color to match the theme.
        this.renderer.background_color = this.theme.background;
        // Load the default drawing sheet.
        log.info("Loading drawing sheet");
        if (!this.drawing_sheet) {
            this.drawing_sheet = DrawingSheet.default();
        }
        this.drawing_sheet.document = this.document;
        // Setup graphical layers
        log.info("Creating layers");
        this.disposables.disposeAndRemove(this.layers);
        this.layers = this.disposables.add(this.create_layer_set());
        // Paint the board
        log.info("Painting items");
        this.painter = this.create_painter();
        this.painter.paint(this.document);
        // Paint the drawing sheet
        log.info("Painting drawing sheet");
        new DrawingSheetPainter(this.renderer, this.layers, this.theme).paint(this.drawing_sheet);
        // Create the grid
        log.info("Painting grid");
        this.grid = new Grid(this.renderer, this.viewport.camera, this.layers.by_name(ViewLayerNames.grid), this.grid_origin, this.theme.grid, this.theme.grid_axes);
    }
    zoom_to_page() {
        this.viewport.camera.bbox = this.drawing_sheet.page_bbox.grow(10);
        this.draw();
    }
    draw() {
        if (!this.viewport) {
            return;
        }
        this.grid?.update();
        super.draw();
    }
    select(item) {
        // If value wasn't explicitly null and no item was found, give up.
        if (item != null && !(item instanceof BBox)) {
            throw new Error(`Unable to select item ${item}, could not find an object that matched.`);
        }
        this.selected = item ?? null;
    }
}
