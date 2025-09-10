/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
/**
 * Painters for drawing sheet items.
 *
 * Each item class has a corresponding Painter implementation.
 */
import { Angle, BBox, Vec2 } from "../../base/math";
import { Polyline } from "../../graphics";
import * as drawing_sheet from "../../kicad/drawing-sheet";
import { EDAText, StrokeFont } from "../../kicad/text";
import { DocumentPainter, ItemPainter } from "../base/painter";
import { ViewLayerNames } from "../base/view-layers";
function offset_point(sheet, point, anchor, constrain = true) {
    const tl = sheet.top_left;
    const tr = sheet.top_right;
    const bl = sheet.bottom_left;
    const br = sheet.bottom_right;
    const bbox = sheet.margin_bbox;
    switch (anchor) {
        case "ltcorner":
            point = tl.add(point);
            break;
        case "rbcorner":
            point = br.sub(point);
            break;
        case "lbcorner":
            point = bl.add(new Vec2(point.x, -point.y));
            break;
        case "rtcorner":
            point = tr.add(new Vec2(-point.x, point.y));
            break;
    }
    if (constrain && !bbox.contains_point(point)) {
        return;
    }
    return point;
}
class LinePainter extends ItemPainter {
    constructor() {
        super(...arguments);
        this.classes = [drawing_sheet.Line];
    }
    layers_for(item) {
        return [ViewLayerNames.drawing_sheet];
    }
    paint(layer, l) {
        const sheet = l.parent;
        const [incrx, incry] = [l.incrx ?? 0, l.incry ?? 0];
        for (let i = 0; i < l.repeat; i++) {
            const offset = new Vec2(incrx * i, incry * i);
            const [start, end] = [
                offset_point(sheet, l.start.position.add(offset), l.start.anchor),
                offset_point(sheet, l.end.position.add(offset), l.start.anchor),
            ];
            if (!start || !end) {
                return;
            }
            this.gfx.line(new Polyline([start, end], l.linewidth || sheet.setup.linewidth, layer.color));
        }
    }
}
class RectPainter extends ItemPainter {
    constructor() {
        super(...arguments);
        this.classes = [drawing_sheet.Rect];
    }
    layers_for(item) {
        return [ViewLayerNames.drawing_sheet];
    }
    paint(layer, r) {
        const sheet = r.parent;
        const [incrx, incry] = [r.incrx ?? 0, r.incry ?? 0];
        for (let i = 0; i < r.repeat; i++) {
            const offset = new Vec2(incrx * i, incry * i);
            const [start, end] = [
                offset_point(sheet, r.start.position.add(offset), r.start.anchor, i > 0),
                offset_point(sheet, r.end.position.add(offset), r.end.anchor, i > 0),
            ];
            if (!start || !end) {
                return;
            }
            const bbox = BBox.from_points([start, end]);
            this.gfx.line(Polyline.from_BBox(bbox, r.linewidth || sheet.setup.linewidth, layer.color));
        }
    }
}
class TbTextPainter extends ItemPainter {
    constructor() {
        super(...arguments);
        this.classes = [drawing_sheet.TbText];
    }
    layers_for(item) {
        return [ViewLayerNames.drawing_sheet];
    }
    paint(layer, t) {
        const edatext = new EDAText(t.shown_text);
        edatext.h_align = "left";
        edatext.v_align = "center";
        edatext.text_angle = Angle.from_degrees(t.rotate);
        switch (t.justify) {
            case "center":
                edatext.h_align = "center";
                edatext.v_align = "center";
                break;
            case "left":
                edatext.h_align = "left";
                break;
            case "right":
                edatext.h_align = "right";
                break;
            case "top":
                edatext.v_align = "top";
                break;
            case "bottom":
                edatext.v_align = "bottom";
                break;
        }
        edatext.attributes.bold = t.font?.bold ?? false;
        edatext.attributes.italic = t.font?.italic ?? false;
        edatext.attributes.color = layer.color;
        edatext.attributes.size = (t.font?.size ?? t.parent.setup.textsize).multiply(10000);
        edatext.attributes.stroke_width =
            (t.font?.linewidth ?? t.parent.setup.textlinewidth) * 10000;
        const [incrx, incry] = [t.incrx ?? 0, t.incry ?? 0];
        for (let i = 0; i < t.repeat; i++) {
            const offset = new Vec2(incrx * i, incry * i);
            const pos = offset_point(t.parent, t.pos.position.add(offset), t.pos.anchor);
            if (!pos) {
                return;
            }
            if (t.incrlabel && t.text.length == 1) {
                const incr = t.incrlabel * i;
                const chrcode = t.text.charCodeAt(0);
                if (chrcode >= "0".charCodeAt(0) &&
                    chrcode <= "9".charCodeAt(0)) {
                    edatext.text = `${incr + chrcode - "0".charCodeAt(0)}`;
                }
                else {
                    edatext.text = String.fromCharCode(chrcode + incr);
                }
            }
            edatext.text_pos = pos?.multiply(10000);
            this.gfx.state.push();
            StrokeFont.default().draw(this.gfx, edatext.shown_text, edatext.text_pos, edatext.attributes);
            this.gfx.state.pop();
        }
    }
}
export class DrawingSheetPainter extends DocumentPainter {
    constructor(gfx, layers, theme) {
        super(gfx, layers, theme);
        this.painter_list = [
            new LinePainter(this, gfx),
            new RectPainter(this, gfx),
            new TbTextPainter(this, gfx),
        ];
    }
    *paintable_layers() {
        yield this.layers.by_name(ViewLayerNames.drawing_sheet);
    }
}
