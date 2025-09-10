import { Color } from "../../base/color";
import { KicadPCB, type BoardTheme } from "../../kicad";
import { ViewLayerSet as BaseLayerSet, ViewLayer } from "../base/view-layers";
export { ViewLayer };
/** Board view layer names
 *
 * There are view layers that correspond to respective board layers, but
 * there are also several graphical layers that are "virtual", such as layers
 * for drill holes and such.
 */
export declare enum LayerNames {
    dwgs_user = "Dwgs.User",
    cmts_user = "Cmts.User",
    eco1_user = "Eco1.User",
    eco2_user = "Eco2.User",
    edge_cuts = "Edge.Cuts",
    margin = "Margin",
    user_1 = "User.1",
    user_2 = "User.2",
    user_3 = "User.3",
    user_4 = "User.4",
    user_5 = "User.5",
    user_6 = "User.6",
    user_7 = "User.7",
    user_8 = "User.8",
    user_9 = "User.9",
    anchors = ":Anchors",
    non_plated_holes = ":NonPlatedHoles",
    via_holes = ":Via:Holes",
    pad_holes = ":Pad:Holes",
    pad_holewalls = ":Pad:HoleWalls",
    via_holewalls = ":Via:HoleWalls",
    pads_front = ":Pads:Front",
    f_cu = "F.Cu",
    f_mask = "F.Mask",
    f_silks = "F.SilkS",
    f_adhes = "F.Adhes",
    f_paste = "F.Paste",
    f_crtyd = "F.CrtYd",
    f_fab = "F.Fab",
    in1_cu = "In1.Cu",
    in2_cu = "In2.Cu",
    in3_cu = "In3.Cu",
    in4_cu = "In4.Cu",
    in5_cu = "In5.Cu",
    in6_cu = "In6.Cu",
    in7_cu = "In7.Cu",
    in8_cu = "In8.Cu",
    in9_cu = "In9.Cu",
    in10_cu = "In10.Cu",
    in11_cu = "In11.Cu",
    in12_cu = "In12.Cu",
    in13_cu = "In13.Cu",
    in14_cu = "In14.Cu",
    in15_cu = "In15.Cu",
    in16_cu = "In16.Cu",
    in17_cu = "In17.Cu",
    in18_cu = "In18.Cu",
    in19_cu = "In19.Cu",
    in20_cu = "In20.Cu",
    in21_cu = "In21.Cu",
    in22_cu = "In22.Cu",
    in23_cu = "In23.Cu",
    in24_cu = "In24.Cu",
    in25_cu = "In25.Cu",
    in26_cu = "In26.Cu",
    in27_cu = "In27.Cu",
    in28_cu = "In28.Cu",
    in29_cu = "In29.Cu",
    in30_cu = "In30.Cu",
    pads_back = ":Pads:Back",
    b_cu = "B.Cu",
    b_mask = "B.Mask",
    b_silks = "B.SilkS",
    b_adhes = "B.Adhes",
    b_paste = "B.Paste",
    b_crtyd = "B.CrtYd",
    b_fab = "B.Fab",
    drawing_sheet = 0,
    grid = 0
}
export declare const HoleLayerNames: LayerNames[];
export declare const CopperLayerNames: LayerNames[];
export declare enum CopperVirtualLayerNames {
    bb_via_holes = "BBViaHoles",
    bb_via_hole_walls = "BBViaHoleWalls",
    zones = "Zones"
}
export declare function virtual_layer_for(physical_layer: string, virtual_name: CopperVirtualLayerNames): string;
export declare function copper_layers_between(start_layer_name: string, end_layer_name: string): Generator<LayerNames, void, unknown>;
/**
 * Board view layer set
 */
export declare class LayerSet extends BaseLayerSet {
    theme: BoardTheme;
    /**
     * Create a new LayerSet
     */
    constructor(board: KicadPCB, theme: BoardTheme);
    /**
     * Get the theme color for a given layer.
     */
    color_for(layer_name: string): Color;
    /**
     * @yields layers that coorespond to board layers that should be
     *      displayed in the layer selection UI
     */
    in_ui_order(): Generator<ViewLayer, void, unknown>;
    copper_layers(): Generator<ViewLayer, void, unknown>;
    via_layers(): Generator<ViewLayer, void, unknown>;
    zone_layers(): Generator<ViewLayer, void, unknown>;
    pad_layers(): Generator<ViewLayer, void, unknown>;
    pad_hole_layers(): Generator<ViewLayer, void, unknown>;
    /**
     * @returns true if any copper layer is enabled and visible.
     */
    is_any_copper_layer_visible(): boolean;
    /**
     * Highlights the given layer.
     *
     * The board viewer has to make sure to also highlight associated virtual
     * layers when a physical layer is highlighted
     */
    highlight(layer: string | ViewLayer | null): void;
}
