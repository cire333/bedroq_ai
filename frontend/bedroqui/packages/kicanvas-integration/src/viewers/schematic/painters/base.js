/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { DocumentPainter, ItemPainter } from "../../base/painter";
import { LayerNames } from "../layers";
export class BaseSchematicPainter extends DocumentPainter {
}
export class SchematicItemPainter extends ItemPainter {
    get theme() {
        return this.view_painter.theme;
    }
    get is_dimmed() {
        return this.view_painter.current_symbol?.dnp ?? false;
    }
    dim_color(color) {
        // See SCH_PAINTER::getRenderColor, this desaturates the color and
        // mixes it 50% with the background color. While you might think 50%
        // alpha would be fine, it ends up showing the grid and other stuff
        // behind it.
        color = color.desaturate();
        return color.mix(this.theme.background, 0.5);
    }
    dim_if_needed(color) {
        return this.is_dimmed ? this.dim_color(color) : color;
    }
    determine_stroke(layer, item) {
        const width = item.stroke?.width || this.gfx.state.stroke_width;
        if (width < 0) {
            return { width: 0, color: null };
        }
        const stroke_type = item.stroke?.type ?? "none";
        if (stroke_type == "none") {
            return { width: 0, color: null };
        }
        const default_stroke = layer.name == LayerNames.symbol_foreground
            ? this.theme.component_outline
            : this.theme.note;
        const color = this.dim_if_needed(item.stroke?.color ?? default_stroke);
        return { width, color };
    }
    determine_fill(layer, item) {
        const fill_type = item.fill?.type ?? "none";
        if (fill_type == "none") {
            return null;
        }
        if (fill_type == "background" &&
            layer.name != LayerNames.symbol_background) {
            return null;
        }
        let color;
        switch (fill_type) {
            case "background":
                color = this.theme.component_body;
                break;
            case "outline":
                color = this.theme.component_outline;
                break;
            case "color":
                color = item.fill.color;
                break;
        }
        return this.dim_if_needed(color);
    }
}
