import { Vec2 } from "../../../base/math";
import { Renderer } from "../../../graphics";
import { Effects } from "../../../kicad/common";
import * as schematic_items from "../../../kicad/schematic";
import { type HAlign, type VAlign } from "../../../kicad/text";
import { LayerNames, ViewLayer } from "../layers";
import { SchematicItemPainter } from "./base";
/**
 * Implements KiCAD rendering logic for symbol pins.
 *
 * This is similar in scope to the EDAText class and its children, it's
 * designed to recreate KiCAD's behavior as closely as possible.
 *
 * The logic here is based a few small bits of LIB_PIN and EDA_ITEM, with the
 * ast majority adapted from SCH_PAINTER::draw( const LIB_PIN, ...) - which is
 * a massive method at over 400 lines!
 *
 */
export declare class PinPainter extends SchematicItemPainter {
    classes: (typeof schematic_items.PinInstance)[];
    layers_for(item: schematic_items.PinInstance): LayerNames[];
    paint(layer: ViewLayer, p: schematic_items.PinInstance): void;
    /**
     * Applies symbol transformation (rotation, position, mirror).
     *
     * KiCAD doesn't directly set the transformation for symbol items, instead,
     * it indirectly sets them through individual rotations and transforms.
     * See KiCAD's sch_painter.cpp::orientSymbol.
     */
    static apply_symbol_transformations(pin: PinInfo, transforms: {
        position: Vec2;
        rotations: number;
        mirror_x: boolean;
        mirror_y: boolean;
    }): void;
    /**
     * Rotate the pin
     *
     * Based on LIB_PIN::Rotate, used by apply_symbol_transformations.
     */
    static rotate(pin: PinInfo, center: Vec2, ccw?: boolean): void;
    static mirror_horizontally(pin: PinInfo, center: Vec2): void;
    static mirror_vertically(pin: PinInfo, center: Vec2): void;
    /**
     * Draws the pin's shape- the pin line along with any additional decoration
     * depending on pin type.
     */
    draw_pin_shape(gfx: Renderer, pin: PinInfo): void;
    /**
     * Draw the pin's name and number, if they're visible.
     */
    draw_name_and_number(gfx: Renderer, pin: PinInfo): void;
}
export type PinInfo = {
    pin: schematic_items.PinInstance;
    def: schematic_items.PinDefinition;
    position: Vec2;
    orientation: PinOrientation;
};
type PinOrientation = "right" | "left" | "up" | "down";
/**
 * Internals used to draw the pin's shape.
 *
 * Note: only exported for the benefit of tests!
 */
export declare const PinShapeInternals: {
    stem(position: Vec2, orientation: PinOrientation, length: number): {
        p0: any;
        dir: any;
    };
    draw(gfx: Pick<Renderer, "line" | "circle" | "arc">, electrical_type: schematic_items.PinElectricalType, shape: schematic_items.PinShape, position: Vec2, p0: Vec2, dir: Vec2): void;
};
type PinLabelPlacement = {
    offset: Vec2;
    h_align: HAlign;
    v_align: VAlign;
    orientation: PinOrientation;
};
/**
 * Internals used to draw the pin's labels (name and number).
 *
 * Note: only exported for the benefit of tests!
 */
export declare const PinLabelInternals: {
    /**
     * Handles rotating the label position offset based on the pin's orientation
     */
    orient_label(offset: Vec2, orientation: PinOrientation, h_align: HAlign, v_align: VAlign): PinLabelPlacement;
    /**
     * Places a label inside the symbol body- or to put it another way,
     * places it to the left side of a pin that's on the right side of a symbol
     */
    place_inside(label_offset: number, thickness: number, pin_length: number, orientation: PinOrientation): PinLabelPlacement;
    /**
     * Places a label above the pin
     */
    place_above(text_margin: number, pin_thickness: number, text_thickness: number, pin_length: number, orientation: PinOrientation): PinLabelPlacement;
    /**
     * Places a label below the pin
     */
    place_below(text_margin: number, pin_thickness: number, text_thickness: number, pin_length: number, orientation: PinOrientation): PinLabelPlacement;
    /**
     * Draw a label
     *
     * The placement should be created by calling once of the place_*() methods
     * first.
     *
     */
    draw(gfx: Renderer, text: string, position: Vec2, placement: PinLabelPlacement, effects: Effects, color: Color): void;
};
export {};
