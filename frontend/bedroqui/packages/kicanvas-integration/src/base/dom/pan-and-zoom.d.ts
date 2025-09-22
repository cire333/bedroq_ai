import { Camera2 } from "../math";
export type PanAndZoomCallback = () => void;
/**
 * Interactive Pan and Zoom helper
 */
export declare class PanAndZoom {
    #private;
    readonly target: HTMLElement;
    camera: Camera2;
    callback: PanAndZoomCallback;
    min_zoom: number;
    max_zoom: number;
    bounds?: any;
    /**
     * Create an interactive pan and zoom helper
     * @param {HTMLElement} target - the element to attach to and listen for mouse events
     * @param {Camera2} camera - the camera that will be updated when panning and zooming
     * @param {*} callback - optional callback when pan and zoom happens
     * @param {number} min_zoom
     * @param {number} max_zoom
     */
    constructor(target: HTMLElement, camera: Camera2, callback: PanAndZoomCallback, min_zoom?: number, max_zoom?: number, bounds?: any);
}
