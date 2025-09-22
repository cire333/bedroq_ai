import { BBox, Vec2 } from "../../base/math";
import { EDAText } from "./eda-text";
/**
 * Represents text objects that belong to a symbol. This is just for graphical
 * text and doesn't include fields, pin names, or pin numbers.
 *
 * Note: the methods normalize_text, rotate, mirror_horizontal, and
 * mirror_vertical are all implemented in order to match KiCAD's behavior, see
 * apply_symbol_transformations().
 *
 */
export declare class LibText extends EDAText {
    constructor(text: string);
    get shown_text(): string;
    /**
     * Get world space bounding box
     *
     * Schematic symbols use an "inverted" (bottom to top) Y axis, so this
     * flips the box, rotates it, and flips it back so that it's properly
     * in world space.
     */
    get bounding_box(): BBox;
    /**
     * Returns the center of the text's BBox in world coordinates.
     *
     * This contains the positioning logic KiCAD performs in
     * SCH_PAINTER::Draw(LIB_TEXT). It made more sense for it to be here for
     * us.
     */
    get world_pos(): Vec2;
    /**
     * Applies symbol transformation (rotation, position, mirror).
     *
     * Uses the rotate() and mirror_*() methods to properly orient and position
     * symbol text, since KiCAD does not directly use a symbol's transformation
     * to orient text. Instead, KiCAD deep copies the library symbol then calls
     * rotate() on text items multiple times based on the symbol instance's
     * rotation. This makes it non-trivial to directly set the text's location
     * and orientation, so we adopt their somewhat convoluted method. See
     * KiCAD's sch_painter.cpp::orientSymbol.
     */
    apply_symbol_transformations(transforms: {
        position: Vec2;
        rotations: number;
        mirror_x: boolean;
        mirror_y: boolean;
    }): void;
    /**
     * Internal utility method for offsetting the text position based on the
     * horizontal and vertical justifcation.
     */
    normalize_justification(inverse: boolean): void;
    /**
     * Rotate the text
     *
     * KiCAD's rotation of LIB_TEXT objects is somewhat convoluted, but
     * essentially the text is moved to the center of its current bounding box,
     * rotated around the center, and then offset from the center of the
     * bounding box based on the text justification.
     */
    rotate(center: Vec2, ccw?: boolean): void;
    /**
     * Mirrors the text horizontally.
     *
     * Deals with re-assigning the horizontal justification, as mirroring
     * left aligned text is the same as changing it to right aligned.
     */
    mirror_horizontally(center: Vec2): void;
    /**
     * Mirrors the text vertically.
     *
     * Deals with re-assigning the vertical justification, as mirroring
     * top aligned text is the same as changing it to bottom aligned.
     */
    mirror_vertically(center: Vec2): void;
}
