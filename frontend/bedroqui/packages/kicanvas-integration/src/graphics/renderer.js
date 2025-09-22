/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { Color } from "../base/color";
import { Angle, BBox, Arc as MathArc, Matrix3, Vec2 } from "../base/math";
import { Arc, Circle, Polygon, Polyline } from "./shapes";
/**
 * KiCanvas' abstraction over various graphics backends.
 *
 * In general, KiCanvas uses a retained-mode rendering system. That is,
 * drawing commands are issued to the renderer by a "painter" and the renderer
 * does not immediately draw the specified graphics. Instead, the renderer will
 * compile all of the drawing commands together into a "layer". These layers
 * will be actually rendered later.
 *
 * This approach gives us a hell of a lot of speed in exchange for some memory
 * usage. All of the complex logic to turn schematic or board objects into
 * graphics primitives is done just once before anything is actually rendered.
 * After that, KiCanvas can easily re-draw everything with different
 * transformations, visibilities, and orders without having to re-calculate
 * everything.
 *
 */
export class Renderer {
    #current_bbox;
    #background_color;
    constructor(canvas) {
        this.canvas_size = new Vec2(0, 0);
        this.state = new RenderStateStack();
        this.#background_color = Color.black.copy();
        this.canvas = canvas;
        this.background_color = this.#background_color;
    }
    get background_color() {
        return this.#background_color;
    }
    set background_color(color) {
        this.#background_color = color;
        this.canvas.style.backgroundColor = this.background_color.to_css();
    }
    /**
     * Start a new bbox for automatically tracking bounding boxes of drawn objects.
     */
    start_bbox() {
        this.#current_bbox = new BBox(0, 0, 0, 0);
    }
    /**
     * Adds a bbox to the current bbox.
     */
    add_bbox(bb) {
        if (!this.#current_bbox) {
            return;
        }
        this.#current_bbox = BBox.combine([this.#current_bbox, bb], bb.context);
    }
    /**
     * Stop adding drawing to the current bbox and return it.
     */
    end_bbox(context) {
        const bb = this.#current_bbox;
        if (bb == null) {
            throw new Error("No current bbox");
        }
        bb.context = context;
        this.#current_bbox = null;
        return bb;
    }
    prep_circle(circle_or_center, radius, color) {
        let circle;
        if (circle_or_center instanceof Circle) {
            circle = circle_or_center;
        }
        else {
            circle = new Circle(circle_or_center, radius, color ?? this.state.fill);
        }
        if (!circle.color || circle.color.is_transparent_black) {
            circle.color = this.state.fill ?? Color.transparent_black;
        }
        circle.center = this.state.matrix.transform(circle.center);
        const radial = new Vec2(circle.radius, circle.radius);
        this.add_bbox(BBox.from_points([
            circle.center.add(radial),
            circle.center.sub(radial),
        ]));
        return circle;
    }
    prep_arc(arc_or_center, radius, start_angle, end_angle, width, color) {
        let arc;
        if (arc_or_center instanceof Arc) {
            arc = arc_or_center;
        }
        else {
            arc = new Arc(arc_or_center, radius, start_angle ?? new Angle(0), end_angle ?? new Angle(Math.PI * 2), width ?? this.state.stroke_width, color ?? this.state.stroke);
        }
        if (!arc.color || arc.color.is_transparent_black) {
            arc.color = this.state.stroke ?? Color.transparent_black;
        }
        // TODO: This should probably be its own method.
        const math_arc = new MathArc(arc.center, arc.radius, arc.start_angle, arc.end_angle, arc.width);
        const points = math_arc.to_polyline();
        this.line(new Polyline(points, arc.width, arc.color));
        return arc;
    }
    prep_line(line_or_points, width, color) {
        let line;
        if (line_or_points instanceof Polyline) {
            line = line_or_points;
        }
        else {
            line = new Polyline(line_or_points, width ?? this.state.stroke_width, color ?? this.state.stroke);
        }
        if (!line.color || line.color.is_transparent_black) {
            line.color = this.state.stroke ?? Color.transparent_black;
        }
        line.points = Array.from(this.state.matrix.transform_all(line.points));
        let bbox = BBox.from_points(line.points);
        bbox = bbox.grow(line.width);
        this.add_bbox(bbox);
        return line;
    }
    prep_polygon(polygon_or_points, color) {
        let polygon;
        if (polygon_or_points instanceof Polygon) {
            polygon = polygon_or_points;
        }
        else {
            polygon = new Polygon(polygon_or_points, color ?? this.state.fill);
        }
        if (!polygon.color || polygon.color.is_transparent_black) {
            polygon.color = this.state.fill ?? Color.transparent_black;
        }
        polygon.points = Array.from(this.state.matrix.transform_all(polygon.points));
        this.add_bbox(BBox.from_points(polygon.points));
        return polygon;
    }
    /** Draw a list of glyphs */
    glyphs(glyphs) {
        // TODO
    }
}
export class RenderLayer {
    constructor(renderer, name) {
        this.renderer = renderer;
        this.name = name;
        this.composite_operation = "source-over";
    }
    dispose() {
        this.renderer.remove_layer(this);
    }
}
export class RenderState {
    constructor(matrix = Matrix3.identity(), fill = Color.black, stroke = Color.black, stroke_width = 0) {
        this.matrix = matrix;
        this.fill = fill;
        this.stroke = stroke;
        this.stroke_width = stroke_width;
    }
    copy() {
        return new RenderState(this.matrix.copy(), this.fill?.copy(), this.stroke?.copy(), this.stroke_width);
    }
}
export class RenderStateStack {
    #stack;
    constructor() {
        this.#stack = [new RenderState()];
    }
    get top() {
        return this.#stack.at(-1);
    }
    /**
     * @returns the current transformation matrix
     */
    get matrix() {
        return this.top.matrix;
    }
    /**
     * Set the transformation matrix stack.
     */
    set matrix(mat) {
        this.top.matrix = mat;
    }
    get stroke() {
        return this.top.stroke;
    }
    set stroke(c) {
        this.top.stroke = c;
    }
    get fill() {
        return this.top.fill;
    }
    set fill(c) {
        this.top.fill = c;
    }
    get stroke_width() {
        return this.top.stroke_width;
    }
    set stroke_width(n) {
        this.top.stroke_width = n;
    }
    /**
     * Multiply the current matrix with the given one
     */
    multiply(mat) {
        this.top.matrix.multiply_self(mat);
    }
    /**
     * Save the current state to the stack.
     */
    push() {
        this.#stack.push(this.top.copy());
    }
    /**
     * Pop the current transformation matrix off the stack and restore the
     * previous one.
     */
    pop() {
        this.#stack.pop();
    }
}
