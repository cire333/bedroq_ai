/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { Color } from "../base/color";
import { BBox, Vec2 } from "../base/math";
import { expand_text_vars } from "./common";
import default_sheet from "./default_drawing_sheet.kicad_wks";
import { P, T, parse_expr } from "./parser";
export class DrawingSheet {
    constructor(expr) {
        this.setup = new Setup();
        this.drawings = [];
        Object.assign(this, parse_expr(expr, P.start("kicad_wks"), P.pair("version", T.number), P.pair("generator", T.string), P.item("setup", Setup), P.collection("drawings", "line", T.item(Line, this)), P.collection("drawings", "rect", T.item(Rect, this)), P.collection("drawings", "polygon", T.item(Polygon, this)), P.collection("drawings", "bitmap", T.item(Bitmap, this)), P.collection("drawings", "tbtext", T.item(TbText, this))));
    }
    static default() {
        return new DrawingSheet(default_sheet);
    }
    *items() {
        // Yield a rect to draw the page outline
        yield new Rect(`(rect (name "") (start ${-this.setup.left_margin} ${-this.setup
            .right_margin} ltcorner) (end ${-this.setup
            .right_margin} ${-this.setup
            .bottom_margin} rbcorner) (comment "page outline"))`, this);
        yield* this.drawings;
    }
    get paper() {
        return this.document?.paper;
    }
    get width() {
        return this.paper?.width ?? 297;
    }
    get height() {
        return this.paper?.height ?? 210;
    }
    get size() {
        return new Vec2(this.width, this.height);
    }
    get top_left() {
        return new Vec2(this.setup.left_margin, this.setup.top_margin);
    }
    get top_right() {
        return new Vec2(this.width - this.setup.right_margin, this.setup?.top_margin);
    }
    get bottom_right() {
        return new Vec2(this.width - this.setup.right_margin, this.height - this.setup.bottom_margin);
    }
    get bottom_left() {
        return new Vec2(this.setup.left_margin, this.height - this.setup.bottom_margin);
    }
    get margin_bbox() {
        return BBox.from_points([this.top_left, this.bottom_right]);
    }
    get page_bbox() {
        return BBox.from_corners(0, 0, this.width, this.height);
    }
    resolve_text_var(name) {
        switch (name) {
            case "PAPER":
                return this.paper?.size || "";
            // TODO: Mock values for now, should be provided by the project
            // when that's implemented.
            case "#":
                // Sheet number
                return "1";
            case "##":
                // Sheet count
                return "1";
            case "SHEETPATH":
                // Sheet path (hierarchical path)
                return "/";
            case "KICAD_VERSION":
                // KiCAD Version
                return "KiCanvas Alpha";
        }
        return this.document?.resolve_text_var(name);
    }
}
export class Setup {
    constructor(expr) {
        this.linewidth = 0.15;
        this.textsize = new Vec2(1.5, 1.5);
        this.textlinewidth = 0.15;
        this.top_margin = 10;
        this.left_margin = 10;
        this.bottom_margin = 10;
        this.right_margin = 10;
        if (expr) {
            Object.assign(this, parse_expr(expr, P.start("setup"), P.pair("linewidth", T.number), P.vec2("textsize"), P.pair("textlinewidth", T.number), P.pair("top_margin", T.number), P.pair("left_margin", T.number), P.pair("bottom_margin", T.number), P.pair("right_margin", T.number)));
        }
    }
}
export class Coordinate {
    constructor(expr) {
        this.position = new Vec2(0, 0);
        this.anchor = "rbcorner";
        const parsed = parse_expr(expr, P.positional("start_token"), P.positional("x", T.number), P.positional("y", T.number), P.positional("anchor", T.string));
        this.position.x = parsed["x"];
        this.position.y = parsed["y"];
        this.anchor = parsed["anchor"] ?? this.anchor;
    }
}
export class DrawingSheetItem {
    constructor(parent) {
        this.repeat = 1;
        this.incry = 0;
        this.incrx = 0;
        this.parent = parent;
    }
    static { this.common_expr_defs = [
        P.pair("name", T.string),
        P.pair("comment", T.string),
        P.pair("option", T.string),
        P.pair("repeat", T.number),
        P.pair("incrx", T.number),
        P.pair("incry", T.number),
        P.pair("linewidth", T.number),
    ]; }
}
export class Line extends DrawingSheetItem {
    constructor(expr, parent) {
        super(parent);
        Object.assign(this, parse_expr(expr, P.start("line"), P.item("start", Coordinate), P.item("end", Coordinate), ...DrawingSheetItem.common_expr_defs));
    }
}
export class Rect extends DrawingSheetItem {
    constructor(expr, parent) {
        super(parent);
        Object.assign(this, parse_expr(expr, P.start("rect"), P.item("start", Coordinate), P.item("end", Coordinate), ...DrawingSheetItem.common_expr_defs));
    }
}
export class Polygon extends DrawingSheetItem {
    constructor(expr, parent) {
        super(parent);
        Object.assign(this, parse_expr(expr, P.start("polygon"), P.item("pos", Coordinate), P.pair("rotate", T.number), P.list("pts", T.vec2), ...DrawingSheetItem.common_expr_defs));
    }
}
export class Bitmap extends DrawingSheetItem {
    constructor(expr, parent) {
        super(parent);
        Object.assign(this, parse_expr(expr, P.start("bitmap"), P.item("pos", Coordinate), P.pair("scale", T.number), P.pair("pngdata", T.string), ...DrawingSheetItem.common_expr_defs));
    }
}
export class TbText extends DrawingSheetItem {
    constructor(expr, parent) {
        super(parent);
        this.incrlabel = 1;
        this.rotate = 0;
        Object.assign(this, parse_expr(expr, P.start("tbtext"), P.positional("text"), P.item("pos", Coordinate), P.pair("incrlabel", T.number), P.pair("maxlen", T.number), P.pair("maxheight", T.number), P.item("font", Font), P.pair("rotate", T.number), P.pair("justify", T.string), ...DrawingSheetItem.common_expr_defs));
    }
    get shown_text() {
        return expand_text_vars(this.text, this.parent);
    }
}
export class Font {
    constructor(expr) {
        this.color = Color.transparent_black;
        this.size = new Vec2(1.27, 1.27);
        Object.assign(this, parse_expr(expr, P.start("font"), P.pair("face", T.string), P.atom("bold"), P.atom("italic"), P.vec2("size"), P.pair("linewidth", T.number)));
    }
}
