import { Barrier } from "../../base/async";
import { BBox, Camera2, Matrix3 } from "../../base/math";
import { Renderer } from "../../graphics";
/**
 * Viewport combines a canvas, a renderer, and a camera to represent a view
 * into a scene.
 */
export declare class Viewport {
    #private;
    renderer: Renderer;
    callback: () => void;
    width: number;
    height: number;
    camera: Camera2;
    ready: Barrier;
    /**
     * Create a Scene
     * @param callback - a callback used to re-draw the viewport when it changes.
     */
    constructor(renderer: Renderer, callback: () => void);
    dispose(): void;
    enable_pan_and_zoom(min_zoom?: number, max_zoom?: number): void;
    /**
     * The matrix representing this viewport. This can be passed into rendering
     * methods to display things at the right spot.
     */
    get view_matrix(): Matrix3;
    /**
     * Limit the camera's center within the given bounds.
     */
    set bounds(bb: BBox);
}
