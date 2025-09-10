/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { Matrix3 } from "../../base/math";
import { RenderLayer, Renderer } from "../renderer";
import { PrimitiveSet } from "./vector";
/**
 * WebGL2-based renderer
 */
export class WebGL2Renderer extends Renderer {
    /** Graphics layers */
    #layers;
    /** The layer currently being drawn to. */
    #active_layer;
    /**
     * Create a new WebGL2Renderer
     */
    constructor(canvas) {
        super(canvas);
        /** Graphics layers */
        this.#layers = [];
        /** Projection matrix for clip -> screen */
        this.projection_matrix = Matrix3.identity();
    }
    /**
     * Create and configure the WebGL2 context.
     */
    async setup() {
        const gl = this.canvas.getContext("webgl2", { alpha: false });
        if (gl == null) {
            throw new Error("Unable to create WebGL2 context");
        }
        this.gl = gl;
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.GREATER);
        gl.clearColor(...this.background_color.to_array());
        gl.clearDepth(0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this.update_canvas_size();
        await PrimitiveSet.load_shaders(gl);
    }
    dispose() {
        for (const layer of this.layers) {
            layer.dispose();
        }
        this.gl = undefined;
    }
    update_canvas_size() {
        if (!this.gl) {
            return;
        }
        const dpr = window.devicePixelRatio;
        const rect = this.canvas.getBoundingClientRect();
        const logical_w = rect.width;
        const logical_h = rect.height;
        const pixel_w = Math.round(rect.width * dpr);
        const pixel_h = Math.round(rect.height * dpr);
        if (this.canvas_size.x == pixel_w && this.canvas_size.y == pixel_h) {
            return;
        }
        this.canvas.width = pixel_w;
        this.canvas.height = pixel_h;
        this.gl.viewport(0, 0, pixel_w, pixel_h);
        this.projection_matrix = Matrix3.orthographic(logical_w, logical_h);
    }
    clear_canvas() {
        if (this.gl == null)
            throw new Error("Uninitialized");
        // Upate canvas size and projection matrix if needed
        this.update_canvas_size();
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
    start_layer(name, depth = 0) {
        if (this.gl == null)
            throw new Error("Uninitialized");
        this.#active_layer = new WebGL2RenderLayer(this, name, new PrimitiveSet(this.gl));
    }
    end_layer() {
        if (this.#active_layer == null)
            throw new Error("No active layer");
        this.#active_layer.geometry.commit();
        this.#layers.push(this.#active_layer);
        this.#active_layer = null;
        return this.#layers.at(-1);
    }
    arc(arc_or_center, radius, start_angle, end_angle, width, color) {
        super.prep_arc(arc_or_center, radius, start_angle, end_angle, width, color);
    }
    circle(circle_or_center, radius, color) {
        const circle = super.prep_circle(circle_or_center, radius, color);
        if (!circle.color) {
            return;
        }
        this.#active_layer.geometry.add_circle(circle);
    }
    line(line_or_points, width, color) {
        const line = super.prep_line(line_or_points, width, color);
        if (!line.color) {
            return;
        }
        this.#active_layer.geometry.add_line(line);
    }
    polygon(polygon_or_points, color) {
        const polygon = super.prep_polygon(polygon_or_points, color);
        if (!polygon.color) {
            return;
        }
        this.#active_layer.geometry.add_polygon(polygon);
    }
    get layers() {
        const layers = this.#layers;
        return {
            *[Symbol.iterator]() {
                for (const layer of layers) {
                    yield layer;
                }
            },
        };
    }
    remove_layer(layer) {
        const idx = this.#layers.indexOf(layer);
        if (idx == -1) {
            return;
        }
        this.#layers.splice(idx, 1);
    }
}
class WebGL2RenderLayer extends RenderLayer {
    constructor(renderer, name, geometry) {
        super(renderer, name);
        this.renderer = renderer;
        this.name = name;
        this.geometry = geometry;
    }
    dispose() {
        this.clear();
    }
    clear() {
        this.geometry?.dispose();
    }
    render(transform, depth, global_alpha = 1) {
        const gl = this.renderer.gl;
        const total_transform = this.renderer.projection_matrix.multiply(transform);
        if (this.composite_operation != "source-over") {
            gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
        }
        this.geometry.render(total_transform, depth, global_alpha);
        if (this.composite_operation != "source-over") {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
    }
}
