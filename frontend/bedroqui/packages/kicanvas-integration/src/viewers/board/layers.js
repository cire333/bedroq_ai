/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { Color } from "../../base/color";
import { is_string } from "../../base/types";
import { ViewLayerSet as BaseLayerSet, ViewLayer, } from "../base/view-layers";
export { ViewLayer };
/** Board view layer names
 *
 * There are view layers that correspond to respective board layers, but
 * there are also several graphical layers that are "virtual", such as layers
 * for drill holes and such.
 */
export var LayerNames;
(function (LayerNames) {
    LayerNames["dwgs_user"] = "Dwgs.User";
    LayerNames["cmts_user"] = "Cmts.User";
    LayerNames["eco1_user"] = "Eco1.User";
    LayerNames["eco2_user"] = "Eco2.User";
    LayerNames["edge_cuts"] = "Edge.Cuts";
    LayerNames["margin"] = "Margin";
    LayerNames["user_1"] = "User.1";
    LayerNames["user_2"] = "User.2";
    LayerNames["user_3"] = "User.3";
    LayerNames["user_4"] = "User.4";
    LayerNames["user_5"] = "User.5";
    LayerNames["user_6"] = "User.6";
    LayerNames["user_7"] = "User.7";
    LayerNames["user_8"] = "User.8";
    LayerNames["user_9"] = "User.9";
    LayerNames["anchors"] = ":Anchors";
    LayerNames["non_plated_holes"] = ":NonPlatedHoles";
    LayerNames["via_holes"] = ":Via:Holes";
    LayerNames["pad_holes"] = ":Pad:Holes";
    LayerNames["pad_holewalls"] = ":Pad:HoleWalls";
    LayerNames["via_holewalls"] = ":Via:HoleWalls";
    LayerNames["pads_front"] = ":Pads:Front";
    LayerNames["f_cu"] = "F.Cu";
    LayerNames["f_mask"] = "F.Mask";
    LayerNames["f_silks"] = "F.SilkS";
    LayerNames["f_adhes"] = "F.Adhes";
    LayerNames["f_paste"] = "F.Paste";
    LayerNames["f_crtyd"] = "F.CrtYd";
    LayerNames["f_fab"] = "F.Fab";
    LayerNames["in1_cu"] = "In1.Cu";
    LayerNames["in2_cu"] = "In2.Cu";
    LayerNames["in3_cu"] = "In3.Cu";
    LayerNames["in4_cu"] = "In4.Cu";
    LayerNames["in5_cu"] = "In5.Cu";
    LayerNames["in6_cu"] = "In6.Cu";
    LayerNames["in7_cu"] = "In7.Cu";
    LayerNames["in8_cu"] = "In8.Cu";
    LayerNames["in9_cu"] = "In9.Cu";
    LayerNames["in10_cu"] = "In10.Cu";
    LayerNames["in11_cu"] = "In11.Cu";
    LayerNames["in12_cu"] = "In12.Cu";
    LayerNames["in13_cu"] = "In13.Cu";
    LayerNames["in14_cu"] = "In14.Cu";
    LayerNames["in15_cu"] = "In15.Cu";
    LayerNames["in16_cu"] = "In16.Cu";
    LayerNames["in17_cu"] = "In17.Cu";
    LayerNames["in18_cu"] = "In18.Cu";
    LayerNames["in19_cu"] = "In19.Cu";
    LayerNames["in20_cu"] = "In20.Cu";
    LayerNames["in21_cu"] = "In21.Cu";
    LayerNames["in22_cu"] = "In22.Cu";
    LayerNames["in23_cu"] = "In23.Cu";
    LayerNames["in24_cu"] = "In24.Cu";
    LayerNames["in25_cu"] = "In25.Cu";
    LayerNames["in26_cu"] = "In26.Cu";
    LayerNames["in27_cu"] = "In27.Cu";
    LayerNames["in28_cu"] = "In28.Cu";
    LayerNames["in29_cu"] = "In29.Cu";
    LayerNames["in30_cu"] = "In30.Cu";
    LayerNames["pads_back"] = ":Pads:Back";
    LayerNames["b_cu"] = "B.Cu";
    LayerNames["b_mask"] = "B.Mask";
    LayerNames["b_silks"] = "B.SilkS";
    LayerNames["b_adhes"] = "B.Adhes";
    LayerNames["b_paste"] = "B.Paste";
    LayerNames["b_crtyd"] = "B.CrtYd";
    LayerNames["b_fab"] = "B.Fab";
    LayerNames[LayerNames["drawing_sheet"] = 0] = "drawing_sheet";
    LayerNames[LayerNames["grid"] = 0] = "grid";
})(LayerNames || (LayerNames = {}));
export const HoleLayerNames = [
    LayerNames.non_plated_holes,
    LayerNames.via_holes,
    LayerNames.pad_holes,
    LayerNames.pad_holewalls,
    LayerNames.via_holewalls,
];
export const CopperLayerNames = [
    LayerNames.f_cu,
    LayerNames.in1_cu,
    LayerNames.in2_cu,
    LayerNames.in3_cu,
    LayerNames.in4_cu,
    LayerNames.in5_cu,
    LayerNames.in6_cu,
    LayerNames.in7_cu,
    LayerNames.in8_cu,
    LayerNames.in9_cu,
    LayerNames.in10_cu,
    LayerNames.in11_cu,
    LayerNames.in12_cu,
    LayerNames.in13_cu,
    LayerNames.in14_cu,
    LayerNames.in15_cu,
    LayerNames.in16_cu,
    LayerNames.in17_cu,
    LayerNames.in18_cu,
    LayerNames.in19_cu,
    LayerNames.in20_cu,
    LayerNames.in21_cu,
    LayerNames.in22_cu,
    LayerNames.in23_cu,
    LayerNames.in24_cu,
    LayerNames.in25_cu,
    LayerNames.in26_cu,
    LayerNames.in27_cu,
    LayerNames.in28_cu,
    LayerNames.in29_cu,
    LayerNames.in30_cu,
    LayerNames.b_cu,
];
export var CopperVirtualLayerNames;
(function (CopperVirtualLayerNames) {
    CopperVirtualLayerNames["bb_via_holes"] = "BBViaHoles";
    CopperVirtualLayerNames["bb_via_hole_walls"] = "BBViaHoleWalls";
    CopperVirtualLayerNames["zones"] = "Zones";
})(CopperVirtualLayerNames || (CopperVirtualLayerNames = {}));
export function virtual_layer_for(physical_layer, virtual_name) {
    return `:${physical_layer}:${virtual_name}`;
}
function is_virtual(name) {
    return name.startsWith(":");
}
function is_virtual_for(physical_layer, layer_name) {
    return (is_virtual(layer_name) && layer_name.startsWith(`:${physical_layer}:`));
}
function is_copper(name) {
    return name.endsWith(".Cu");
}
export function* copper_layers_between(start_layer_name, end_layer_name) {
    let found_start = false;
    for (const layer_name of CopperLayerNames) {
        if (layer_name == start_layer_name) {
            found_start = true;
        }
        if (found_start) {
            yield layer_name;
        }
        if (layer_name == end_layer_name) {
            return;
        }
    }
}
/**
 * Board view layer set
 */
export class LayerSet extends BaseLayerSet {
    /**
     * Create a new LayerSet
     */
    constructor(board, theme) {
        super();
        this.theme = theme;
        const board_layers = new Map();
        for (const l of board.layers) {
            board_layers.set(l.canonical_name, l);
        }
        for (const layer_name of Object.values(LayerNames)) {
            // Skip physical layers that aren't present on the board.
            if (!is_virtual(layer_name) && !board_layers.has(layer_name)) {
                continue;
            }
            let visible = true;
            let interactive = false;
            // These virtual layers require at least one visible copper layer to be shown.
            if (HoleLayerNames.includes(layer_name)) {
                visible = () => this.is_any_copper_layer_visible();
                interactive = true;
            }
            // Pad layers require that the front or back layer is visible.
            if (layer_name == LayerNames.pads_front) {
                visible = () => this.by_name(LayerNames.f_cu).visible;
                interactive = true;
            }
            if (layer_name == LayerNames.pads_back) {
                visible = () => this.by_name(LayerNames.b_cu).visible;
                interactive = true;
            }
            // Copper layers require additional virual layers for zones and
            // blind/buried vias. Those are generated here.
            // Zone virtual layers for copper layers require that the referenced
            // copper layer is visible.
            if (is_copper(layer_name)) {
                interactive = true;
                this.add(new ViewLayer(this, virtual_layer_for(layer_name, CopperVirtualLayerNames.bb_via_holes), () => this.by_name(layer_name).visible, false, this.color_for(LayerNames.via_holes)));
                this.add(new ViewLayer(this, virtual_layer_for(layer_name, CopperVirtualLayerNames.bb_via_hole_walls), () => this.by_name(layer_name).visible, false, this.color_for(LayerNames.via_holewalls)));
                this.add(new ViewLayer(this, virtual_layer_for(layer_name, CopperVirtualLayerNames.zones), () => this.by_name(layer_name).visible, false, this.color_for(layer_name)));
            }
            this.add(new ViewLayer(this, layer_name, visible, interactive, this.color_for(layer_name)));
        }
    }
    /**
     * Get the theme color for a given layer.
     */
    color_for(layer_name) {
        switch (layer_name) {
            case LayerNames.drawing_sheet:
                return this.theme["worksheet"] ?? Color.white;
            case LayerNames.pads_front:
                return (this.theme["copper"]?.["f"] ??
                    Color.white);
            case LayerNames.pads_back:
                return (this.theme["copper"]?.["b"] ??
                    Color.white);
            case LayerNames.non_plated_holes:
                return this.theme["non_plated_hole"] ?? Color.white;
            case LayerNames.via_holes:
                return this.theme["via_hole"] ?? Color.white;
            case LayerNames.via_holewalls:
                return this.theme["via_through"] ?? Color.white;
            case LayerNames.pad_holes:
                return this.theme["background"] ?? Color.white;
            case LayerNames.pad_holewalls:
                return this.theme["pad_through_hole"] ?? Color.white;
        }
        let name = layer_name;
        name = name.replace(":Zones:", "").replace(".", "_").toLowerCase();
        if (name.endsWith("_cu")) {
            name = name.replace("_cu", "");
            const copper_theme = this.theme.copper;
            return (copper_theme[name] ?? Color.white);
        }
        return this.theme[name] ?? Color.white;
    }
    /**
     * @yields layers that coorespond to board layers that should be
     *      displayed in the layer selection UI
     */
    *in_ui_order() {
        const order = [
            ...CopperLayerNames,
            LayerNames.f_adhes,
            LayerNames.b_adhes,
            LayerNames.f_paste,
            LayerNames.b_paste,
            LayerNames.f_silks,
            LayerNames.b_silks,
            LayerNames.f_mask,
            LayerNames.b_mask,
            LayerNames.dwgs_user,
            LayerNames.cmts_user,
            LayerNames.eco1_user,
            LayerNames.eco2_user,
            LayerNames.edge_cuts,
            LayerNames.margin,
            LayerNames.f_crtyd,
            LayerNames.b_crtyd,
            LayerNames.f_fab,
            LayerNames.b_fab,
            LayerNames.user_1,
            LayerNames.user_2,
            LayerNames.user_3,
            LayerNames.user_4,
            LayerNames.user_5,
            LayerNames.user_6,
            LayerNames.user_7,
            LayerNames.user_8,
            LayerNames.user_9,
        ];
        for (const name of order) {
            const layer = this.by_name(name);
            if (layer) {
                yield layer;
            }
        }
    }
    *copper_layers() {
        for (const name of CopperLayerNames) {
            const layer = this.by_name(name);
            if (layer) {
                yield layer;
            }
        }
    }
    *via_layers() {
        yield this.by_name(LayerNames.via_holes);
        yield this.by_name(LayerNames.via_holewalls);
        for (const copper_name of CopperLayerNames) {
            for (const virtual_name of [
                CopperVirtualLayerNames.bb_via_hole_walls,
                CopperVirtualLayerNames.bb_via_holes,
            ]) {
                const layer = this.by_name(virtual_layer_for(copper_name, virtual_name));
                if (layer) {
                    yield layer;
                }
            }
        }
    }
    *zone_layers() {
        for (const copper_name of CopperLayerNames) {
            const zones_name = virtual_layer_for(copper_name, CopperVirtualLayerNames.zones);
            const layer = this.by_name(zones_name);
            if (layer) {
                yield layer;
            }
        }
    }
    *pad_layers() {
        yield this.by_name(LayerNames.pads_front);
        yield this.by_name(LayerNames.pads_back);
    }
    *pad_hole_layers() {
        yield this.by_name(LayerNames.pad_holes);
        yield this.by_name(LayerNames.pad_holewalls);
    }
    /**
     * @returns true if any copper layer is enabled and visible.
     */
    is_any_copper_layer_visible() {
        for (const layer of this.copper_layers()) {
            if (layer.visible) {
                return true;
            }
        }
        return false;
    }
    /**
     * Highlights the given layer.
     *
     * The board viewer has to make sure to also highlight associated virtual
     * layers when a physical layer is highlighted
     */
    highlight(layer) {
        let layer_name = "";
        if (layer instanceof ViewLayer) {
            layer_name = layer.name;
        }
        else if (is_string(layer)) {
            layer_name = layer;
        }
        const matching_layers = this.query((l) => l.name == layer_name || is_virtual_for(layer_name, l.name));
        super.highlight(matching_layers);
    }
}
