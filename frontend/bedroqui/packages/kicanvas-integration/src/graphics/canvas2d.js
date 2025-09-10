/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { Matrix3 } from "../base/math";
import { Renderer, RenderLayer, RenderStateStack } from "./renderer";
/**
 * Canvas2d-based renderer.
 *
 * This renderer works by turning draw calls into DrawCommands - basically
 * serializing them as Path2D + state. These DrawCommands are combined into
 * multiple Layers. When the layers are later drawn, the draw commands are
 * stepped through and draw onto the canvas.
 *
 * This is similar to generating old-school display lists.
 *
 */
export class Canvas2DRenderer extends Renderer {
    /** Graphics layers */
    #layers;
    /** The layer currently being drawn to. */
    #active_layer;
    /**
     * Create a new Canvas2DRenderer
     */
    constructor(canvas) {
        super(canvas);
        /** Graphics layers */
        this.#layers = [];
        /** State */
        this.state = new RenderStateStack();
    }
    /**
     * Create and configure the 2D Canvas context.
     */
    async setup() {
        const ctx2d = this.canvas.getContext("2d", {
            alpha: false,
            desynchronized: true,
        });
        if (ctx2d == null) {
            throw new Error("Unable to create Canvas2d context");
        }
        this.ctx2d = ctx2d;
        this.update_canvas_size();
    }
    dispose() {
        this.ctx2d = undefined;
        for (const layer of this.#layers) {
            layer.dispose();
        }
    }
    update_canvas_size() {
        const dpr = window.devicePixelRatio;
        const rect = this.canvas.getBoundingClientRect();
        const pixel_w = Math.round(rect.width * dpr);
        const pixel_h = Math.round(rect.height * dpr);
        if (this.canvas.width != pixel_w || this.canvas.height != pixel_h) {
            this.canvas.width = pixel_w;
            this.canvas.height = pixel_h;
        }
    }
    clear_canvas() {
        this.update_canvas_size();
        this.ctx2d.setTransform();
        this.ctx2d.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.ctx2d.fillStyle = this.background_color.to_css();
        this.ctx2d.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx2d.lineCap = "round";
        this.ctx2d.lineJoin = "round";
    }
    start_layer(name) {
        this.#active_layer = new Canvas2dRenderLayer(this, name);
    }
    end_layer() {
        if (!this.#active_layer) {
            throw new Error("No active layer");
        }
        this.#layers.push(this.#active_layer);
        this.#active_layer = null;
        return this.#layers.at(-1);
    }
    arc(arc_or_center, radius, start_angle, end_angle, width, color) {
        super.prep_arc(arc_or_center, radius, start_angle, end_angle, width, color);
    }
    circle(circle_or_center, radius, color) {
        const circle = super.prep_circle(circle_or_center, radius, color);
        if (!circle.color || circle.color.is_transparent_black) {
            return;
        }
        const css_color = circle.color.to_css();
        const path = new Path2D();
        path.arc(circle.center.x, circle.center.y, circle.radius, 0, Math.PI * 2);
        this.#active_layer.commands.push(new DrawCommand(path, css_color, null, 0));
    }
    line(line_or_points, width, color) {
        const line = super.prep_line(line_or_points, width, color);
        if (!line.color || line.color.is_transparent_black) {
            return;
        }
        const css_color = line.color.to_css();
        const path = new Path2D();
        let started = false;
        for (const point of line.points) {
            if (!started) {
                path.moveTo(point.x, point.y);
                started = true;
            }
            else {
                path.lineTo(point.x, point.y);
            }
        }
        this.#active_layer.commands.push(new DrawCommand(path, null, css_color, line.width));
    }
    polygon(polygon_or_points, color) {
        const polygon = super.prep_polygon(polygon_or_points, color);
        if (!polygon.color || polygon.color.is_transparent_black) {
            return;
        }
        const css_color = polygon.color.to_css();
        const path = new Path2D();
        let started = false;
        for (const point of polygon.points) {
            if (!started) {
                path.moveTo(point.x, point.y);
                started = true;
            }
            else {
                path.lineTo(point.x, point.y);
            }
        }
        path.closePath();
        this.#active_layer.commands.push(new DrawCommand(path, css_color, null, 0));
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
class DrawCommand {
    constructor(path, fill, stroke, stroke_width) {
        this.path = path;
        this.fill = fill;
        this.stroke = stroke;
        this.stroke_width = stroke_width;
        this.path_count = 1;
    }
    render(ctx) {
        ctx.fillStyle = this.fill ?? "black";
        ctx.strokeStyle = this.stroke ?? "black";
        ctx.lineWidth = this.stroke_width;
        if (this.fill) {
            ctx.fill(this.path);
        }
        if (this.stroke) {
            ctx.stroke(this.path);
        }
    }
}
class Canvas2dRenderLayer extends RenderLayer {
    constructor(renderer, name, commands = []) {
        super(renderer, name);
        this.renderer = renderer;
        this.name = name;
        this.commands = commands;
    }
    dispose() {
        this.clear();
    }
    clear() {
        this.commands = [];
    }
    push_path(path, fill, stroke, stroke_width) {
        const last_command = this.commands.at(-1);
        if (last_command &&
            (last_command.path_count < 20,
                last_command.fill == fill &&
                    last_command.stroke == stroke &&
                    last_command.stroke_width == stroke_width)) {
            last_command.path.addPath(path);
            last_command.path_count++;
        }
        else {
            this.commands.push(new DrawCommand(path, fill, stroke, stroke_width));
        }
    }
    render(transform, depth, global_alpha = 1) {
        const ctx = this.renderer.ctx2d;
        if (!ctx) {
            throw new Error("No CanvasRenderingContext2D!");
        }
        ctx.save();
        ctx.globalCompositeOperation = this.composite_operation;
        ctx.globalAlpha = global_alpha;
        const accumulated_transform = Matrix3.from_DOMMatrix(ctx.getTransform());
        accumulated_transform.multiply_self(transform);
        ctx.setTransform(accumulated_transform.to_DOMMatrix());
        for (const command of this.commands) {
            command.render(ctx);
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}
