import { Vec2 } from "./vec2";
import { Matrix3 } from "./matrix3";
import { Angle, type AngleLike } from "./angle";
import { BBox } from "./bbox";
/**
 * A camera in 2d space.
 *
 * This manages the minimal state required to pan, zoom, and rotate. It's
 * abstract and isn't integrated into any specific graphics backend. Use
 * .matrix to get the complete transformation matrix to pass to whichever
 * graphics backend you're using.
 */
export declare class Camera2 {
    viewport_size: Vec2;
    center: Vec2;
    zoom: number;
    rotation: Angle;
    /**
     * Create a camera
     * @param {Vec2} viewport_size - The width and height of the viewport
     * @param {Vec2} center - The point at which the camera's view is centered
     * @param {number} zoom - Scale factor, increasing numbers zoom the camera in.
     * @param {number|Angle} rotation - Rotation (roll) in radians.
     */
    constructor(viewport_size?: Vec2, center?: Vec2, zoom?: number, rotation?: Angle);
    /**
     * Relative translation
     * @param v
     */
    translate(v: Vec2): void;
    /**
     * Relative rotation
     * @param {Angle|number} a - rotation in radians
     */
    rotate(a: AngleLike): void;
    /**
     * Complete transformation matrix.
     */
    get matrix(): Matrix3;
    /**
     * Bounding box representing the camera's view
     * */
    get bbox(): BBox;
    /**
     * Move the camera and adjust zoom so that the given bounding box is in
     * view.
     */
    set bbox(bbox: BBox);
    get top(): number;
    get bottom(): number;
    get left(): number;
    get right(): number;
    /**
     * Apply this camera to a 2d canvas
     *
     * A simple convenience method that sets the canvas's transform to
     * the camera's transformation matrix.
     */
    apply_to_canvas(ctx: CanvasRenderingContext2D): void;
    /**
     * Transform screen coordinates to world coordinates
     */
    screen_to_world(v: Vec2): Vec2;
    /**
     * Transform world coordinates to screen coordinates
     */
    world_to_screen(v: Vec2): Vec2;
}
