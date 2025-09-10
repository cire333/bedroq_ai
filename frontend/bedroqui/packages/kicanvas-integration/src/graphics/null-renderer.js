/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { RenderLayer, Renderer } from "./renderer";
export class NullRenderLayer extends RenderLayer {
    constructor() {
        super(...arguments);
        this.shapes = [];
    }
    dispose() {
        this.clear();
    }
    clear() {
        this.shapes = [];
    }
    render(camera) { }
}
export class NullRenderer extends Renderer {
    #active_layer;
    constructor() {
        super(null);
    }
    set background_color(color) { }
    async setup() { }
    async dispose() { }
    update_canvas_size() { }
    clear_canvas() { }
    start_layer(name) {
        this.#active_layer = new NullRenderLayer(this, name);
    }
    end_layer() {
        return this.#active_layer;
    }
    get layers() {
        return [];
    }
    circle(circle_or_center, radius, color) {
        this.#active_layer.shapes.push(super.prep_circle(circle_or_center, radius, color));
    }
    arc(arc_or_center, radius, start_angle, end_angle, width, color) {
        this.#active_layer.shapes.push(super.prep_arc(arc_or_center, radius, start_angle, end_angle, width, color));
    }
    line(line_or_points, width, color) {
        this.#active_layer.shapes.push(super.prep_line(line_or_points, width, color));
    }
    polygon(polygon_or_points, color) {
        this.#active_layer.shapes.push(super.prep_polygon(polygon_or_points, color));
    }
    remove_layer(layer) { }
}
