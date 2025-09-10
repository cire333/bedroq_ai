import { Angle, type AngleLike } from "./angle";
export type Vec2Like = Vec2 | {
    x: number;
    y: number;
} | [number, number] | number;
/**
 * A 2-dimensional point vector
 *
 * All operations except for set() return new vectors and do not modify the existing vector
 */
export declare class Vec2 {
    x: number;
    y: number;
    /**
     * Create a Vec2
     */
    constructor(x?: Vec2Like, y?: number);
    /**
     * Copy this vector
     */
    copy(): Vec2;
    /**
     * Update this vector's values
     */
    set(x: Vec2Like, y?: number): void;
    /** Iterate through [x, y] */
    [Symbol.iterator](): Generator<number, void, unknown>;
    get magnitude(): number;
    get squared_magnitude(): number;
    /**
     * @returns the perpendicular normal of this vector
     */
    get normal(): Vec2;
    /**
     * @returns the direction (angle) of this vector
     */
    get angle(): Angle;
    /**
     * KiCAD has to be weird about this, ofc.
     */
    get kicad_angle(): Angle;
    /**
     * @returns A new unit vector in the same direction as this vector
     */
    normalize(): Vec2;
    equals(b?: Vec2): boolean;
    add(b: Vec2): Vec2;
    sub(b: Vec2): Vec2;
    scale(b: Vec2): Vec2;
    rotate(angle: AngleLike): Vec2;
    multiply(s: Vec2 | number): Vec2;
    resize(len: number): Vec2;
    cross(b: Vec2): number;
    static segment_intersect(a1: Vec2, b1: Vec2, a2: Vec2, b2: Vec2): Vec2 | null;
}
