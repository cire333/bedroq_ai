import { Color } from "../../base/color";
import type { IDisposable } from "../../base/disposable";
import { Matrix3 } from "../../base/math";
import { Circle, Polygon, Polyline } from "../shapes";
import { Buffer, ShaderProgram, VertexArray } from "./helpers";
/**
 * A set of filled circles.
 */
export declare class CircleSet implements IDisposable {
    gl: WebGL2RenderingContext;
    static shader: ShaderProgram;
    shader: ShaderProgram;
    vao: VertexArray;
    position_buf: Buffer;
    cap_region_buf: Buffer;
    color_buf: Buffer;
    vertex_count: number;
    /**
     * Load the shader program required to render this primitive.
     */
    static load_shader(gl: WebGL2RenderingContext): Promise<void>;
    /**
     * Create a new circle set.
     * @param shader - optional override for the shader program used when drawing.
     */
    constructor(gl: WebGL2RenderingContext, shader?: ShaderProgram);
    /**
     * Release GPU resources
     */
    dispose(): void;
    /**
     * Tesselate an array of circles and upload them to the GPU.
     */
    set(circles: Circle[]): void;
    render(): void;
}
/**
 * A set of stroked polylines
 */
export declare class PolylineSet implements IDisposable {
    gl: WebGL2RenderingContext;
    static shader: ShaderProgram;
    shader: ShaderProgram;
    vao: VertexArray;
    position_buf: Buffer;
    cap_region_buf: Buffer;
    color_buf: Buffer;
    vertex_count: number;
    /**
     * Load the shader program required to render this primitive.
     */
    static load_shader(gl: WebGL2RenderingContext): Promise<void>;
    /**
     * Create a new polyline set.
     * @param {WebGL2RenderingContext} gl
     * @param {ShaderProgram?} shader - optional override for the shader program used when drawing.
     */
    constructor(gl: WebGL2RenderingContext, shader?: ShaderProgram);
    /**
     * Release GPU resources
     */
    dispose(): void;
    /**
     * Tesselate an array of polylines and upload them to the GPU.
     */
    set(lines: Polyline[]): void;
    render(): void;
}
/**
 * A set of filled polygons
 */
export declare class PolygonSet implements IDisposable {
    gl: WebGL2RenderingContext;
    static shader: ShaderProgram;
    shader: ShaderProgram;
    vao: VertexArray;
    position_buf: Buffer;
    color_buf: Buffer;
    vertex_count: number;
    /**
     * Load the shader program required to render this primitive.
     */
    static load_shader(gl: WebGL2RenderingContext): Promise<void>;
    /**
     * Create a new polygon set.
     * @param {WebGL2RenderingContext} gl
     * @param {ShaderProgram?} shader - optional override for the shader program used when drawing.
     */
    constructor(gl: WebGL2RenderingContext, shader?: ShaderProgram);
    /**
     * Release GPU resources
     */
    dispose(): void;
    /**
     * Convert an array of triangle vertices to polylines.
     *
     * This is a helper function for debugging. It allows easily drawing the
     * outlines of the results of triangulation.
     *
     */
    static polyline_from_triangles(triangles: Float32Array, width: number, color: Color): Polyline[];
    /**
     * Tesselate (triangulate) and upload a list of polygons to the GPU.
     */
    set(polygons: Polygon[]): void;
    render(): void;
}
/**
 * A set of primitives
 *
 * This is the primary interface to this module. It's used to collect a set
 * of primitives (circles, polylines, and polygons), upload their data to the
 * GPU, and draw them together. This is conceptually a "layer", all primitives
 * are drawn at the same depth.
 *
 * Like the underlying primitive sets, this is intended to be write once. Once
 * you call commit() the primitive data is released from working RAM and exists
 * only in the GPU buffers. To modify the data, you'd dispose() of this layer
 * and create a new one.
 *
 */
export declare class PrimitiveSet implements IDisposable {
    #private;
    gl: WebGL2RenderingContext;
    /**
     * Load all shader programs required to render primitives.
     */
    static load_shaders(gl: WebGL2RenderingContext): Promise<void>;
    /**
     * Create a new primitive set
     */
    constructor(gl: WebGL2RenderingContext);
    /**
     * Release GPU resources
     */
    dispose(): void;
    /**
     * Clear committed geometry
     */
    clear(): void;
    /**
     * Collect a new filled circle
     */
    add_circle(circle: Circle): void;
    /**
     * Collect a new filled polygon
     */
    add_polygon(polygon: Polygon): void;
    /**
     * Collect a new polyline
     */
    add_line(line: Polyline): void;
    /**
     * Tesselate all collected primitives and upload their data to the GPU.
     */
    commit(): void;
    /**
     * Draw all the previously commit()ed primitives
     * @param matrix - complete view/projection matrix
     * @param depth - used for depth testing
     * @parama alpha - overrides the alpha for colors
     */
    render(matrix: Matrix3, depth?: number, alpha?: number): void;
}
