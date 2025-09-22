import { Angle, BBox, Vec2 } from "../../base/math";
/**
 * Glyph abstract base class
 *
 * Shared between stroke and outline fonts, altough outline fonts aren't
 * currently implemented.
 */
export declare abstract class Glyph {
    abstract transform(glyph_size: Vec2, offset: Vec2, tilt: number, angle: Angle, mirror: boolean, origin: Vec2): Glyph;
    abstract get bbox(): BBox;
}
type Stroke = Vec2[];
/**
 * Glyphs for stroke fonts.
 */
export declare class StrokeGlyph extends Glyph {
    strokes: Stroke[];
    bbox: BBox;
    constructor(strokes: Stroke[], bbox: BBox);
    transform(glyph_size: Vec2, offset: Vec2, tilt: number, angle: Angle, mirror: boolean, origin: Vec2): StrokeGlyph;
}
export {};
