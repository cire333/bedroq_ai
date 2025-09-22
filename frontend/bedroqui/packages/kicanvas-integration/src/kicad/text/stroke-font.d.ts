import { Angle, BBox, Vec2 } from "../../base/math";
import { Font, TextStyle } from "./font";
import { Glyph, StrokeGlyph } from "./glyph";
/** Stroke font
 *
 * Stroke font are "Hershey" fonts comprised of strokes.
 *
 * This class is adapted from KiCAD's STROKE_FONT.
 */
export declare class StrokeFont extends Font {
    #private;
    static readonly overbar_position_factor = 1.4;
    static readonly underline_position_factor = -0.16;
    static readonly font_scale: number;
    static readonly font_offset = -10;
    private static instance?;
    static default(): StrokeFont;
    constructor();
    /** Get a glyph for a specific character. */
    get_glyph(c: string): StrokeGlyph;
    get_line_extents(text: string, size: Vec2, thickness: number, bold: boolean, italic: boolean): Vec2;
    compute_underline_vertical_position(glyph_height: number): number;
    compute_overbar_vertical_position(glyph_height: number): number;
    get_interline(glyph_height: number, line_spacing?: number): number;
    get_text_as_glyphs(text: string, size: Vec2, position: Vec2, angle: Angle, mirror: boolean, origin: Vec2, style: TextStyle): {
        bbox: BBox;
        glyphs: Glyph[];
        cursor: Vec2;
    };
}
