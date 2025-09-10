/**
 * Basic abstract geometric primitives that can be drawn using the Renderer
 * classes. These are dumb data structures- the actual code used to draw
 * them is implemented as part of the specific Renderer.
 */
import { Angle, BBox, Vec2 } from "../base/math";
import { Color } from "../base/color";
type OptionalDefaultColor = Color | false | null;
/** A filled circle */
export declare class Circle {
    center: Vec2;
    radius: number;
    color: OptionalDefaultColor;
    /**
     * Create a filled circle
     * @param center - center of circle
     * @param radius - circle radius
     * @param color - fill color
     */
    constructor(center: Vec2, radius: number, color: OptionalDefaultColor);
}
/** A stroked circular arc */
export declare class Arc {
    center: Vec2;
    radius: number;
    start_angle: Angle;
    end_angle: Angle;
    width: number;
    color: OptionalDefaultColor;
    /**
     * Create a stroked arc
     * @param center - center of arc circle
     * @param radius - arc circle radius
     * @param start_angle - arc start angle
     * @param end_angle - arc end angle
     * @param color - stroke color
     */
    constructor(center: Vec2, radius: number, start_angle: Angle, end_angle: Angle, width: number, color: OptionalDefaultColor);
}
/** Stroked polyline */
export declare class Polyline {
    points: Vec2[];
    width: number;
    color: OptionalDefaultColor;
    /**
     * Create a stroked polyline
     * @param points - line segment points
     * @param width - thickness of the rendered lines
     * @param color - stroke color
     */
    constructor(points: Vec2[], width: number, color: OptionalDefaultColor);
    /**
     * Create a rectangular outline from a bounding box.
     * @param bb
     * @param width - thickness of the rendered lines
     * @param color - fill color
     */
    static from_BBox(bb: BBox, width: number, color: Color): Polyline;
}
/** Filled polygon */
export declare class Polygon {
    points: Vec2[];
    color: OptionalDefaultColor;
    vertices: Float32Array;
    /**
     * Create a filled polygon
     * @param points - point cloud representing the polygon
     * @param color - fill color
     */
    constructor(points: Vec2[], color: OptionalDefaultColor);
    /**
     * Create a filled polygon from a bounding box.
     * @param bb
     * @param color - fill color
     */
    static from_BBox(bb: BBox, color: Color): Polygon;
}
export type Shape = Circle | Arc | Polygon | Polyline;
export {};
