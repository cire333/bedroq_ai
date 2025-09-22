/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { Color } from "../base/color";
import { Vec2 } from "../base/math";
import { P, T, parse_expr } from "./parser";
export function unescape_string(str) {
    const escape_vars = {
        dblquote: '"',
        quote: "'",
        lt: "<",
        gt: ">",
        backslash: "\\",
        slash: "/",
        bar: "|",
        comma: ",",
        colon: ":",
        space: " ",
        dollar: "$",
        tab: "\t",
        return: "\n",
        brace: "{",
    };
    for (const [k, v] of Object.entries(escape_vars)) {
        str = str.replaceAll("{" + k + "}", v);
    }
    return str;
}
export function expand_text_vars(text, resolveable) {
    text = unescape_string(text);
    if (resolveable === undefined) {
        return text;
    }
    text = text.replaceAll(/(\$\{(.+?)\})/g, (substring, all, name) => {
        const val = resolveable.resolve_text_var(name);
        if (val === undefined) {
            return all;
        }
        return val;
    });
    return text;
}
export class At {
    constructor(expr) {
        this.position = new Vec2(0, 0);
        this.rotation = 0;
        this.unlocked = false;
        if (expr) {
            const parsed = parse_expr(expr, P.start("at"), P.positional("x", T.number), P.positional("y", T.number), P.positional("rotation", T.number), P.atom("unlocked"));
            this.position.set(parsed.x, parsed.y);
            this.rotation = parsed.rotation ?? this.rotation;
            this.unlocked = parsed.unlocked ?? this.unlocked;
        }
    }
    copy() {
        const at = new At();
        at.position = this.position.copy();
        at.rotation = this.rotation;
        at.unlocked = this.unlocked;
        return at;
    }
}
export const PaperSize = {
    User: [431.8, 279.4],
    A0: [1189, 841],
    A1: [841, 594],
    A2: [594, 420],
    A3: [420, 297],
    A4: [297, 210],
    A5: [210, 148],
    A: [279.4, 215.9],
    B: [431.8, 279.4],
    C: [558.8, 431.8],
    D: [863.6, 558.8],
    E: [1117.6, 863.6],
    USLetter: [279.4, 215.9],
    USLegal: [355.6, 215.9],
    USLedger: [431.8, 279.4],
};
export class Paper {
    constructor(expr) {
        this.portrait = false;
        Object.assign(this, parse_expr(expr, P.start("paper"), P.atom("size", Object.keys(PaperSize)), P.positional("width", T.number), P.positional("height", T.number), P.atom("portrait")));
        const paper_size = PaperSize[this.size];
        if (!this.width && paper_size) {
            this.width = paper_size[0];
        }
        if (!this.height && paper_size) {
            this.height = paper_size[1];
        }
        if (this.size != "User" && this.portrait) {
            [this.width, this.height] = [this.height, this.width];
        }
    }
}
export class TitleBlock {
    constructor(expr) {
        this.title = "";
        this.date = "";
        this.rev = "";
        this.company = "";
        this.comment = {};
        /*
        (title_block
            (title "Starfish")
            (date "2022-12-18")
            (rev "v2")
            (company "Winterbloom")
            (comment 1 "Alethea Flowers")
            (comment 2 "CERN-OHL-S V2")
            (comment 3 "starfish.wntr.dev")
        )
        */
        if (expr) {
            Object.assign(this, parse_expr(expr, P.start("title_block"), P.pair("title", T.string), P.pair("date", T.string), P.pair("rev", T.string), P.pair("company", T.string), P.expr("comment", (obj, name, e) => {
                const ep = e;
                const record = obj[name] ?? {};
                record[ep[1]] = ep[2];
                return record;
            })));
        }
    }
    resolve_text_var(name) {
        return new Map([
            ["ISSUE_DATE", this.date],
            ["REVISION", this.rev],
            ["TITLE", this.title],
            ["COMPANY", this.company],
            ["COMMENT1", this.comment[1] ?? ""],
            ["COMMENT2", this.comment[2] ?? ""],
            ["COMMENT3", this.comment[3] ?? ""],
            ["COMMENT4", this.comment[4] ?? ""],
            ["COMMENT5", this.comment[5] ?? ""],
            ["COMMENT6", this.comment[6] ?? ""],
            ["COMMENT7", this.comment[7] ?? ""],
            ["COMMENT8", this.comment[8] ?? ""],
            ["COMMENT9", this.comment[9] ?? ""],
        ]).get(name);
    }
}
export class Effects {
    constructor(expr) {
        this.font = new Font();
        this.justify = new Justify();
        this.hide = false;
        if (expr) {
            Object.assign(this, parse_expr(expr, P.start("effects"), P.item("font", Font), P.item("justify", Justify), P.atom("hide"), P.color()));
        }
    }
    copy() {
        const e = new Effects();
        e.font = this.font.copy();
        e.justify = this.justify.copy();
        e.hide = this.hide;
        return e;
    }
}
export class Font {
    constructor(expr) {
        this.size = new Vec2(1.27, 1.27);
        this.thickness = 0;
        this.bold = false;
        this.italic = false;
        this.color = Color.transparent_black;
        if (expr) {
            Object.assign(this, parse_expr(expr, P.start("font"), P.pair("face", T.string), P.vec2("size"), P.pair("thickness", T.number), P.atom("bold"), P.atom("italic"), P.pair("line_spacing", T.number), P.color()));
            // Note: KiCAD saves height as the first number and width as the
            // second. I have no fucking idea why they did that.
            [this.size.x, this.size.y] = [this.size.y, this.size.x];
        }
    }
    copy() {
        const f = new Font();
        f.face = this.face;
        f.size = this.size.copy();
        f.thickness = this.thickness;
        f.bold = this.bold;
        f.italic = this.italic;
        return f;
    }
}
export class Justify {
    constructor(expr) {
        this.horizontal = "center";
        this.vertical = "center";
        this.mirror = false;
        if (expr) {
            Object.assign(this, parse_expr(expr, P.start("justify"), P.atom("horizontal", ["left", "right"]), P.atom("vertical", ["top", "bottom"]), P.atom("mirror")));
        }
    }
    copy() {
        const j = new Justify();
        j.horizontal = this.horizontal;
        j.vertical = this.vertical;
        j.mirror = this.mirror;
        return j;
    }
}
export class Stroke {
    constructor(expr) {
        this.type = "default";
        /* (stroke (width 0.508) (type default) (color 0 0 0 0)) */
        Object.assign(this, parse_expr(expr, P.start("stroke"), P.pair("width", T.number), P.pair("type", T.string), P.color()));
    }
}
