import { Color } from "../base/color";
import { Angle, Matrix3, Vec2 } from "../base/math";
import { Renderer, RenderLayer, RenderStateStack } from "./renderer";
import { Arc, Circle, Polygon, Polyline } from "./shapes";
/**
 * Canvas2d-based renderer.
 *
 * This renderer works by turning draw calls into DrawCommands - basically
 * serializing them as Path2D + state. These DrawCommands are combined into
 * multiple Layers. When the layers are later drawn, the draw commands are
 * stepped through and draw onto the canvas.
 *
 * This is similar to generating old-school display lists.
 *
 */
export declare class Canvas2DRenderer extends Renderer {
    #private;
    /** State */
    state: RenderStateStack;
    ctx2d?: CanvasRenderingContext2D;
    /**
     * Create a new Canvas2DRenderer
     */
    constructor(canvas: HTMLCanvasElement);
    /**
     * Create and configure the 2D Canvas context.
     */
    setup(): Promise<void>;
    dispose(): void;
    update_canvas_size(): void;
    clear_canvas(): void;
    start_layer(name: string): void;
    end_layer(): RenderLayer;
    arc(arc_or_center: Arc | Vec2, radius?: number, start_angle?: Angle, end_angle?: Angle, width?: number, color?: Color): void;
    circle(circle_or_center: Circle | Vec2, radius?: number, color?: Color): void;
    line(line_or_points: Polyline | Vec2[], width?: number, color?: Color): void;
    polygon(polygon_or_points: Polygon | Vec2[], color?: Color): void;
    get layers(): {
        [Symbol.iterator](): Generator<Canvas2dRenderLayer, void, unknown>;
    };
    remove_layer(layer: Canvas2dRenderLayer): void;
}
declare class DrawCommand {
    path: Path2D;
    fill: string | null;
    stroke: string | null;
    stroke_width: number;
    path_count: number;
    constructor(path: Path2D, fill: string | null, stroke: string | null, stroke_width: number);
    render(ctx: CanvasRenderingContext2D): void;
}
declare class Canvas2dRenderLayer extends RenderLayer {
    readonly renderer: Renderer;
    readonly name: string;
    commands: DrawCommand[];
    constructor(renderer: Renderer, name: string, commands?: DrawCommand[]);
    dispose(): void;
    clear(): void;
    push_path(path: Path2D, fill: string | null, stroke: string | null, stroke_width: number): void;
    render(transform: Matrix3, depth: number, global_alpha?: number): void;
}
export {};
