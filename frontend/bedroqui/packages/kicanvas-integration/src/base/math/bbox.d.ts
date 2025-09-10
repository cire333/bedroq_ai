import { Matrix3 } from "./matrix3";
import { Vec2 } from "./vec2";
/**
 * An axis-alignment bounding box (AABB)
 */
export declare class BBox {
    x: number;
    y: number;
    w: number;
    h: number;
    context?: any;
    /**
     * Create a bounding box
     */
    constructor(x?: number, y?: number, w?: number, h?: number, context?: any);
    copy(): BBox;
    /**
     * Create a BBox given the top left and bottom right corners
     */
    static from_corners(x1: number, y1: number, x2: number, y2: number, context?: any): BBox;
    /**
     * Create a BBox that contains all the given points
     */
    static from_points(points: Vec2[], context?: any): BBox;
    /**
     * Combine two or more BBoxes into a new BBox that contains both
     */
    static combine(boxes: Iterable<BBox>, context?: any): BBox;
    /**
     * @returns true if the bbox has a non-zero area
     */
    get valid(): boolean;
    get start(): Vec2;
    set start(v: Vec2);
    get end(): Vec2;
    set end(v: Vec2);
    get top_left(): Vec2;
    get top_right(): Vec2;
    get bottom_left(): Vec2;
    get bottom_right(): Vec2;
    get x2(): number;
    set x2(v: number);
    get y2(): number;
    set y2(v: number);
    get center(): Vec2;
    /**
     * @returns A new BBox transformed by the given matrix.
     */
    transform(mat: Matrix3): BBox;
    /**
     * @returns A new BBox with the size uniformly modified from the center
     */
    grow(dx: number, dy?: number): BBox;
    scale(s: number): BBox;
    /**
     * @returns a BBox flipped around the X axis (mirrored Y)
     */
    mirror_vertical(): BBox;
    /** returns true if this box contains the other */
    contains(other: BBox): boolean;
    /**
     * @returns true if the point is within the bounding box.
     */
    contains_point(v: Vec2): boolean;
    /**
     * @returns A new Vec2 constrained within this bounding box
     */
    constrain_point(v: Vec2): Vec2;
    intersect_segment(a: Vec2, b: Vec2): Vec2 | null;
}
