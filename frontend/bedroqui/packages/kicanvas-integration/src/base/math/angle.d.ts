import { Vec2 } from "./vec2";
export type AngleLike = Angle | number;
/**
 * An angle for rotation and orientation
 */
export declare class Angle {
    #private;
    /**
     * Convert radians to degrees
     */
    static rad_to_deg(radians: number): number;
    /**
     * Convert degrees to radians
     */
    static deg_to_rad(degrees: number): number;
    /** Round degrees to two decimal places
     *
     * A lot of math involving angles is done with degrees to two decimal places
     * instead of radians to match KiCAD's behavior and to avoid floating point
     * nonsense.
     */
    static round(degrees: number): number;
    /**
     * Create an Angle
     */
    constructor(radians: AngleLike);
    copy(): Angle;
    get radians(): number;
    set radians(v: number);
    get degrees(): number;
    set degrees(v: number);
    static from_degrees(v: number): Angle;
    /**
     * Returns a new Angle representing the sum of this angle and the given angle.
     */
    add(other: AngleLike): Angle;
    /**
     * Returns a new Angle representing the different of this angle and the given angle.
     */
    sub(other: AngleLike): Angle;
    /**
     * @returns a new Angle constrained to 0 to 360 degrees.
     */
    normalize(): Angle;
    /**
     * @returns a new Angle constrained to -180 to 180 degrees.
     */
    normalize180(): Angle;
    /**
     * @returns a new Angle constrained to -360 to +360 degrees.
     */
    normalize720(): Angle;
    /**
     * @returns a new Angle that's reflected in the other direction, for
     * example, 90 degrees ends up being -90 or 270 degrees (when normalized).
     */
    negative(): Angle;
    get is_vertical(): boolean;
    get is_horizontal(): boolean;
    rotate_point(point: Vec2, origin?: Vec2): Vec2;
}
