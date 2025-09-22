import { Angle, BBox } from "../../base/math";
import { At, Effects } from "../common";
import { TextAttributes } from "./font";
/** Primary text mixin
 *
 * KiCAD uses EDA_TEXT as a sort of grab-bag of various things needed to render
 * text across both Eeschema and Pcbnew. There is a lot of meandering code
 * because it has mostly been worked on piecemeal over the years, so there's
 * some stuff that is a little weird and some code that does almost the same
 * thing as other code. I've done my best to keep the structure clean while
 * carefully matching KiCAD's behavior, but it's still a lot to wrap your
 * head around.
 *
 * Note: Just like the underlying Font class, this all expects
 * scaled internal units instead of mm!
 */
export declare class EDAText {
    constructor(text: string);
    /**
     * Apply "effects" parsed from schematic or board files.
     *
     * KiCAD uses Effects to encapsulate all of the various text
     * options, this translates it into TextAttributes used by Font.
     */
    apply_effects(effects: Effects): void;
    /**
     * Apply "at" parsed from schematic or board files.
     *
     * KiCAD uses At to encapsulate both position and rotation. How this is
     * actually applied various based on the actual text item.
     */
    apply_at(at: At): void;
    /** The unprocessed text value, as it would be seen in save files */
    text: string;
    /** The processed text that will be used for rendering */
    get shown_text(): string;
    /** Effective text width selected either the text thickness specified in
     * attributes if it's a valid value or the given default value. */
    get_effective_text_thickness(default_thickness?: number): number;
    text_pos: any;
    attributes: TextAttributes;
    get text_angle(): Angle;
    set text_angle(a: Angle);
    get italic(): boolean;
    get bold(): boolean;
    get visible(): boolean;
    get mirrored(): boolean;
    get multiline(): boolean;
    get h_align(): import("./font").HAlign;
    set h_align(v: import("./font").HAlign);
    get v_align(): import("./font").VAlign;
    set v_align(v: import("./font").VAlign);
    get line_spacing(): number;
    get text_size(): Vec2;
    get text_width(): any;
    get text_height(): any;
    get text_color(): Color;
    get keep_upright(): boolean;
    get text_thickness(): number;
    /**
     * Get the bounding box for a line or lines of text.
     *
     * Used by .bounding_box in LibText and SchField.
     *
     * Note: text is always treated as non-rotated.
     *
     * @param line - which line to measure, if null all lines are measured.
     * @param invert_y - inverts the y axis when calculating the bbox. Used
     *                   by eeschema for symbol text items.
     */
    get_text_box(line?: number, invert_y?: boolean): BBox;
}
