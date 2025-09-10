import type { Color } from "../base/color";
import { Angle, Matrix3, Vec2 } from "../base/math";
import { RenderLayer, Renderer } from "./renderer";
import { Arc, Circle, Polygon, Polyline, type Shape } from "./shapes";
export declare class NullRenderLayer extends RenderLayer {
    shapes: Shape[];
    dispose(): void;
    clear(): void;
    render(camera: Matrix3): void;
}
export declare class NullRenderer extends Renderer {
    #private;
    constructor();
    set background_color(color: Color);
    setup(): Promise<void>;
    dispose(): Promise<void>;
    update_canvas_size(): void;
    clear_canvas(): void;
    start_layer(name: string): void;
    end_layer(): NullRenderLayer;
    get layers(): Iterable<RenderLayer>;
    circle(circle_or_center: Circle | Vec2, radius?: number, color?: Color): void;
    arc(arc_or_center: Arc | Vec2, radius?: number, start_angle?: Angle, end_angle?: Angle, width?: number, color?: Color): void;
    line(line_or_points: Polyline | Vec2[], width?: number, color?: Color): void;
    polygon(polygon_or_points: Polygon | Vec2[], color?: Color): void;
    remove_layer(layer: RenderLayer): void;
}
