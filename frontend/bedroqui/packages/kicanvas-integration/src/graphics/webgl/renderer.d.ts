import { Color } from "../../base/color";
import { Angle, Matrix3, Vec2 } from "../../base/math";
import { RenderLayer, Renderer } from "../renderer";
import { Arc, Circle, Polygon, Polyline } from "../shapes";
import { PrimitiveSet } from "./vector";
/**
 * WebGL2-based renderer
 */
export declare class WebGL2Renderer extends Renderer {
    #private;
    /** Projection matrix for clip -> screen */
    projection_matrix: Matrix3;
    /** WebGL backend */
    gl?: WebGL2RenderingContext;
    /**
     * Create a new WebGL2Renderer
     */
    constructor(canvas: HTMLCanvasElement);
    /**
     * Create and configure the WebGL2 context.
     */
    setup(): Promise<void>;
    dispose(): void;
    update_canvas_size(): void;
    clear_canvas(): void;
    start_layer(name: string, depth?: number): void;
    end_layer(): RenderLayer;
    arc(arc_or_center: Arc | Vec2, radius?: number, start_angle?: Angle, end_angle?: Angle, width?: number, color?: Color): void;
    circle(circle_or_center: Circle | Vec2, radius?: number, color?: Color): void;
    line(line_or_points: Polyline | Vec2[], width?: number, color?: Color): void;
    polygon(polygon_or_points: Polygon | Vec2[], color?: Color): void;
    get layers(): Iterable<RenderLayer>;
    remove_layer(layer: WebGL2RenderLayer): void;
}
declare class WebGL2RenderLayer extends RenderLayer {
    readonly renderer: WebGL2Renderer;
    readonly name: string;
    geometry: PrimitiveSet;
    constructor(renderer: WebGL2Renderer, name: string, geometry: PrimitiveSet);
    dispose(): void;
    clear(): void;
    render(transform: Matrix3, depth: number, global_alpha?: number): void;
}
export {};
