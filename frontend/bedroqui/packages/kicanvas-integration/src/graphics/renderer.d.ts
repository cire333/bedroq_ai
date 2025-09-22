import { Color } from "../base/color";
import type { IDisposable } from "../base/disposable";
import { Angle, BBox, Matrix3, Vec2 } from "../base/math";
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
export declare abstract class Renderer implements IDisposable {
    #private;
    canvas: HTMLCanvasElement;
    canvas_size: Vec2;
    state: RenderStateStack;
    constructor(canvas: HTMLCanvasElement);
    get background_color(): Color;
    set background_color(color: Color);
    abstract setup(): Promise<void>;
    abstract dispose(): void;
    /**
     * Update the canvas and context with the new viewport size if needed. This
     * is typically called by clear_canvas().
     */
    abstract update_canvas_size(): void;
    /**
     * Clear the canvas. Typically called at the start of a frame.
     */
    abstract clear_canvas(): void;
    /**
     * Start a new bbox for automatically tracking bounding boxes of drawn objects.
     */
    start_bbox(): void;
    /**
     * Adds a bbox to the current bbox.
     */
    add_bbox(bb: BBox): void;
    /**
     * Stop adding drawing to the current bbox and return it.
     */
    end_bbox(context: any): BBox;
    /**
     * Start a new layer of graphics.
     *
     * Each layer represents a set of primitives
     * that are all drawn at the same time and at the same depth. end_layer()
     * must be called for the graphics to actually show up.
     */
    abstract start_layer(name: string): void;
    /**
     * Finish a layer of graphics.
     *
     * Performs any additional work needed such as tesselation and buffer
     * management.
     */
    abstract end_layer(): RenderLayer;
    /**
     * Iterate through layers.
     */
    abstract get layers(): Iterable<RenderLayer>;
    /**
     * Remove a layer, called automatically by layer.dispose
     */
    abstract remove_layer(layer: RenderLayer): void;
    /**
     * Draw a filled circle
     */
    abstract circle(circle: Circle): void;
    abstract circle(center: Vec2, radius: number, color?: Color): void;
    abstract circle(circle_or_center: Circle | Vec2, radius?: number, color?: Color): void;
    protected prep_circle(circle_or_center: Circle | Vec2, radius?: number, color?: Color): Circle;
    /**
     * Draw a stroked arc
     */
    abstract arc(arc: Arc): void;
    abstract arc(center: Vec2, radius: number, start_angle: Angle, end_angle: Angle, width?: number, color?: Color): void;
    abstract arc(arc_or_center: Arc | Vec2, radius?: number, start_angle?: Angle, end_angle?: Angle, width?: number, color?: Color): void;
    protected prep_arc(arc_or_center: Arc | Vec2, radius?: number, start_angle?: Angle, end_angle?: Angle, width?: number, color?: Color): Arc;
    /**
     * Draw a stroked polyline
     */
    abstract line(line: Polyline): void;
    abstract line(points: Vec2[], width?: number, color?: Color): void;
    abstract line(line_or_points: Polyline | Vec2[], width?: number, color?: Color): void;
    protected prep_line(line_or_points: Polyline | Vec2[], width?: number, color?: Color): Polyline;
    /**
     * Draw a filled polygon
     */
    abstract polygon(polygon: Polygon): void;
    abstract polygon(points: Vec2[], color?: Color): void;
    abstract polygon(polygon_or_points: Polygon | Vec2[], color?: Color): void;
    protected prep_polygon(polygon_or_points: Polygon | Vec2[], color?: Color): Polygon;
    /** Draw a list of glyphs */
    glyphs(glyphs: any[]): void;
}
export declare abstract class RenderLayer implements IDisposable {
    readonly renderer: Renderer;
    readonly name: string;
    composite_operation: GlobalCompositeOperation;
    constructor(renderer: Renderer, name: string);
    dispose(): void;
    abstract clear(): void;
    abstract render(camera: Matrix3, depth: number, global_alpha?: number): void;
}
export declare class RenderState {
    matrix: Matrix3;
    fill: Color;
    stroke: Color;
    stroke_width: number;
    constructor(matrix?: Matrix3, fill?: Color, stroke?: Color, stroke_width?: number);
    copy(): RenderState;
}
export declare class RenderStateStack {
    #private;
    constructor();
    get top(): RenderState;
    /**
     * @returns the current transformation matrix
     */
    get matrix(): Matrix3;
    /**
     * Set the transformation matrix stack.
     */
    set matrix(mat: Matrix3);
    get stroke(): Color;
    set stroke(c: Color);
    get fill(): Color;
    set fill(c: Color);
    get stroke_width(): number;
    set stroke_width(n: number);
    /**
     * Multiply the current matrix with the given one
     */
    multiply(mat: Matrix3): void;
    /**
     * Save the current state to the stack.
     */
    push(): void;
    /**
     * Pop the current transformation matrix off the stack and restore the
     * previous one.
     */
    pop(): void;
}
