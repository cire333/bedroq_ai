import { Camera2 } from "../../base/math";
import { Renderer } from "../../graphics";
import { ViewLayer } from "./view-layers";
/**
 * Grid level of detail (LOD) definition.
 *
 * Used to draw the grid with higher spacing when zoomed out.
 */
export declare class GridLOD {
    min_zoom: number;
    spacing: number;
    radius: number;
    constructor(min_zoom: number, spacing: number, radius: number);
}
/**
 * Grid drawing helper
 *
 * The grid is one of few things in KiCanvas that's dynamic- it needs to change
 * depending on the camera's viewport. Since it needs to update when the user
 * is actively moving the camera care has to be taken to avoid performance
 * issues due to the amount of geometry that needs to be generated.
 *
 * This grid helper avoid regenerating grid geometry unless necessary. It keeps
 * track of the last camera bbox it generated geometry for and doesn't
 * regenerate unless the new bbox is outside of that area. It also uses GridLOD
 * to generate less geometry when zoomed out.
 */
export declare class Grid {
    #private;
    gfx: Renderer;
    camera: Camera2;
    layer: ViewLayer;
    origin: any;
    color: any;
    origin_color: any;
    lods: GridLOD[];
    constructor(gfx: Renderer, camera: Camera2, layer: ViewLayer, origin?: any, color?: any, origin_color?: any, lods?: GridLOD[]);
    reset(): void;
    update(): void;
}
