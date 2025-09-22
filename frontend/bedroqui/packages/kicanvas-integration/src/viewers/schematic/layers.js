/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { ViewLayerSet as BaseLayerSet, ViewLayer, } from "../base/view-layers";
import { Color } from "../../base/color";
export { ViewLayer };
export var LayerNames;
(function (LayerNames) {
    // Bounding boxes for clickable items
    LayerNames["interactive"] = ":Interactive";
    // DNP and other marks.
    LayerNames["marks"] = ":Marks";
    // reference, value, other symbol fields
    LayerNames["symbol_field"] = ":Symbol:Field";
    // hierarchical, global, and local labels
    LayerNames["label"] = ":Label";
    // regular junctions, bus junctions, no connects
    LayerNames["junction"] = ":Junction";
    // wires and buses
    LayerNames["wire"] = ":Wire";
    // symbol outlines, pin names, pin numbers
    LayerNames["symbol_foreground"] = ":Symbol:Foreground";
    // Text, rectangles, etc. not inside of symbols.
    LayerNames["notes"] = ":Notes";
    LayerNames["bitmap"] = ":Bitmap";
    // symbol pins
    LayerNames["symbol_pin"] = ":Symbol:Pin";
    // symbol body fill
    LayerNames["symbol_background"] = ":Symbol:Background";
    LayerNames[LayerNames["drawing_sheet"] = 0] = "drawing_sheet";
    LayerNames[LayerNames["grid"] = 0] = "grid";
})(LayerNames || (LayerNames = {}));
/**
 * Represents the complete set of layers used by a View to draw a schematic.
 *
 * While a schematic doesn't have physical layers like a board, it still has
 * "virtual" layers used to make sure things are drawn in the right order.
 */
export class LayerSet extends BaseLayerSet {
    constructor(theme) {
        super();
        this.theme = theme;
        for (const name of Object.values(LayerNames)) {
            this.add(new ViewLayer(this, name));
        }
        this.by_name(LayerNames.interactive).visible = false;
        this.by_name(LayerNames.interactive).interactive = true;
        this.by_name(LayerNames.drawing_sheet).color =
            this.theme["worksheet"] ?? Color.white;
    }
    *interactive_layers() {
        // Only the top interactive layer is clickable for schematics
        yield this.by_name(LayerNames.interactive);
    }
}
