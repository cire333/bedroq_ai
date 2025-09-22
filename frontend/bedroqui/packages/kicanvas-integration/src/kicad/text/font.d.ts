import { Angle, BBox, Vec2 } from "../../base/math";
import { Color, Renderer } from "../../graphics";
import { Glyph } from "./glyph";
import { MarkupNode } from "./markup";
/** Font base class
 *
 * Defines the interface and common methods used for both
 * stroke fonts and (eventually) outline fonts.
 *
 * Note: KiCAD always passes any coordinates or sizes in scaled internal units
 * (1 UI = 1 nm for PCBNew and 1 UI = 100 nm for EESchema). That is, 1.27 mm is
 * represented as 12700 IU for EESchema and 1270000 IU for PCBNew. See KiCAD's
 * EDA_UNITS for more details. Importantly, this means this code will likely
 * not work as expected if you use unscaled units!
 *
 * This is largely adapted from KiCAD's KIFONT::FONT base class and beaten
 * to death with a TypeScript hammer.
 */
export declare abstract class Font {
    name: string;
    /** Used to apply italic slant to stroke fonts and to estimate size of italic outline fonts. */
    static readonly italic_tilt: number;
    /** Used to determine the spacing between two lines */
    static readonly interline_pitch_ratio = 1.62;
    constructor(name: string);
    draw(gfx: Renderer | null, text: string, position: Vec2, attributes: TextAttributes): void;
    /**
     * Computes the width and height of a single line of marked up text.
     *
     * Corresponds to KiCAD's FONT::StringBoundaryLimits
     *
     * Used by EDAText.get_text_box(), which, inexplicably, doesn't use
     * get_line_bbox() for what I can only assume is historical reasons.
     *
     * @param text - the text, should be a single line of markup.
     * @param size - width and height of a glyph
     * @param thickness - text thickness, used only to inflate the bounding box.
     * @param bold - note: currently ignored by stroke font, as boldness is
     *               applied by increasing the thickness.
     */
    get_line_extents(text: string, size: Vec2, thickness: number, bold: boolean, italic: boolean): Vec2;
    /**
     * Adds additional line breaks to the given marked up text in order to limit
     * the overall width to the given column_width.
     *
     * Note: this behaves like KiCAD's FONT::LinebreakText in that it only
     * breaks on spaces, it does not break within superscript, subscript, or
     * overbar, and it doesn't bother with justification.
     *
     * Used by SCH_TEXTBOX & PCB_TEXTBOX.
     *
     * @param bold - note: ignored by stroke font, as boldness is applied by
     *               increasing the thickness.
     */
    break_lines(text: string, column_width: number, glyph_size: Vec2, thickness: number, bold: boolean, italic: boolean): string;
    abstract compute_overbar_vertical_position(glyph_height: number): number;
    abstract compute_underline_vertical_position(glyph_height: number): number;
    abstract get_interline(glyph_height: number, line_spacing: number): number;
    /**
     * Builds a list of glyphs from the given text string.
     *
     * @param size - cap height and em width
     * @param position - position of the text or the cursor position after the
     *                   last text.
     * @param origin - the origin point used for rotation and mirroring.
     */
    abstract get_text_as_glyphs(text: string, size: Vec2, position: Vec2, angle: Angle, mirror: boolean, origin: Vec2, style: TextStyle): {
        bbox: BBox;
        glyphs: Glyph[];
        cursor: Vec2;
    };
    /**
     * Draws a single line of text.
     *
     * Multitext text must be split before calling this function.
     *
     * Corresponds to KiCAD's Font::DrawSingleLineText
     *
     * Used by draw()
     */
    protected draw_line(gfx: Renderer | null, text: string, position: Vec2, origin: Vec2, attributes: TextAttributes): BBox;
    /**
     * Computes the bounding box for a single line of text.
     *
     * Corresponds to KiCAD's FONT::boundingBoxSingleLine
     *
     * Used by get_line_positions() and draw()
     */
    protected get_line_bbox(text: string, position: Vec2, size: Vec2, italic: boolean): {
        bbox: BBox;
        cursor: Vec2;
    };
    /**
     * Get positions for each line in a multiline text.
     *
     * Used by draw()
     */
    protected get_line_positions(text: string, position: Vec2, attributes: TextAttributes): {
        text: string;
        position: Vec2;
        extents: Vec2;
    }[];
    /**
     * Converts marked up text to glyphs
     *
     * Corresponds to KiCAD's FONT::drawMarkup, which doesn't actually draw,
     * just converts to glyphs.
     *
     * Used by string_boundary_limits(), draw_single_line_text(), and
     * bbox_single_line()
     */
    protected get_markup_as_glyphs(text: string, position: Vec2, size: Vec2, angle: Angle, mirror: boolean, origin: Vec2, style: TextStyle): {
        next_position: Vec2;
        bbox: BBox;
        glyphs: Glyph[];
    };
    /** Internal method used by get_markup_as_glyphs */
    protected get_markup_node_as_glyphs(node: MarkupNode, position: Vec2, size: Vec2, angle: Angle, mirror: boolean, origin: Vec2, style: TextStyle): {
        next_position: Vec2;
        bbox: BBox;
        glyphs: Glyph[];
    };
    /** Breaks text up into words, accounting for markup.
     *
     * Corresponds to KiCAD's FONT::workbreakMarkup
     *
     * As per KiCAD, a word can represent an actual word or a run of text
     * with subscript, superscript, or overbar applied.
     *
     * Used by SCH_TEXTBOX & PCB_TEXTBOX
     */
    protected wordbreak_markup(text: string, size: Vec2, style: TextStyle): {
        word: string;
        width: number;
    }[];
    /** Internal method used by wordbreak_markup */
    protected wordbreak_markup_node(node: MarkupNode, size: Vec2, style: TextStyle): {
        word: string;
        width: number;
    }[];
}
export declare class TextStyle {
    bold: boolean;
    italic: boolean;
    subscript: boolean;
    superscript: boolean;
    overbar: boolean;
    underline: boolean;
    constructor(bold?: boolean, italic?: boolean, subscript?: boolean, superscript?: boolean, overbar?: boolean, underline?: boolean);
    copy(): TextStyle;
}
export type HAlign = "left" | "center" | "right";
export type VAlign = "top" | "center" | "bottom";
export declare class TextAttributes {
    font: Font | null;
    h_align: HAlign;
    v_align: VAlign;
    angle: Angle;
    line_spacing: number;
    stroke_width: number;
    italic: boolean;
    bold: boolean;
    underlined: boolean;
    color: Color;
    visible: boolean;
    mirrored: boolean;
    multiline: boolean;
    size: Vec2;
    /** Used to keep the text from being rotated upside-down
     * or backwards and becoming difficult to read. */
    keep_upright: boolean;
    copy(): TextAttributes;
}
