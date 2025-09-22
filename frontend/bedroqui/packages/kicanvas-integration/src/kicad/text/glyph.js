/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
/**
 * Glyph abstract base class
 *
 * Shared between stroke and outline fonts, altough outline fonts aren't
 * currently implemented.
 */
export class Glyph {
}
/**
 * Glyphs for stroke fonts.
 */
export class StrokeGlyph extends Glyph {
    constructor(strokes, bbox) {
        super();
        this.strokes = strokes;
        this.bbox = bbox;
    }
    transform(glyph_size, offset, tilt, angle, mirror, origin) {
        // Note: our bbox calculation differs from KiCAD's, however,
        // when I wrote this it seems to be consistent in terms of final
        // outcome.
        const bb = this.bbox.copy();
        bb.x = offset.x + bb.x * glyph_size.x;
        bb.y = offset.y + bb.y * glyph_size.y;
        bb.w = bb.w * glyph_size.x;
        bb.h = bb.h * glyph_size.y;
        if (tilt) {
            bb.w += bb.h * tilt;
        }
        const strokes = [];
        for (const src_stroke of this.strokes) {
            const points = [];
            for (const src_point of src_stroke) {
                let point = src_point.multiply(glyph_size);
                if (tilt > 0) {
                    point.x -= point.y * tilt;
                }
                point = point.add(offset);
                if (mirror) {
                    point.x = origin.x - (point.x - origin.x);
                }
                if (angle.degrees != 0) {
                    point = angle.rotate_point(point, origin);
                }
                points.push(point);
            }
            strokes.push(points);
        }
        return new StrokeGlyph(strokes, bb);
    }
}
