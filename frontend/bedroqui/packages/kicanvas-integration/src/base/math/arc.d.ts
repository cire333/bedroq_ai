import { Angle } from "./angle";
import { BBox } from "./bbox";
import { Vec2 } from "./vec2";
/**
 * A circular arc
 */
export declare class Arc {
    center: Vec2;
    radius: number;
    start_angle: Angle;
    end_angle: Angle;
    width: number;
    /**
     * Create a new Arc
     */
    constructor(center: Vec2, radius: number, start_angle: Angle, end_angle: Angle, width: number);
    /**
     * Create an Arc given three points on a circle
     */
    static from_three_points(start: Vec2, mid: Vec2, end: Vec2, width?: number): Arc;
    static from_center_start_end(center: Vec2, start: Vec2, end: Vec2, width: number): Arc;
    get start_radial(): Vec2;
    get start_point(): Vec2;
    get end_radial(): Vec2;
    get end_point(): Vec2;
    get mid_angle(): Angle;
    get mid_radial(): Vec2;
    get mid_point(): Vec2;
    get arc_angle(): Angle;
    /**
     * Approximate the Arc using a polyline
     */
    to_polyline(): Vec2[];
    /**
     * Same as to_polyline, but includes the arc center
     */
    to_polygon(): Vec2[];
    /**
     * Get a bounding box that encloses the entire arc.
     */
    get bbox(): BBox;
}
