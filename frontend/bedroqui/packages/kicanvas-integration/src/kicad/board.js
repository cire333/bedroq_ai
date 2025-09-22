/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { Angle, BBox, Arc as MathArc, Matrix3, Vec2 } from "../base/math";
import { At, Effects, Paper, Stroke, TitleBlock, expand_text_vars, } from "./common";
import { P, T, parse_expr } from "./parser";
export class KicadPCB {
    constructor(filename, expr) {
        this.filename = filename;
        this.title_block = new TitleBlock();
        this.properties = new Map();
        this.layers = [];
        this.nets = [];
        this.footprints = [];
        this.zones = [];
        this.segments = [];
        this.vias = [];
        this.drawings = [];
        this.groups = [];
        Object.assign(this, parse_expr(expr, P.start("kicad_pcb"), P.pair("version", T.number), P.pair("generator", T.string), P.object("general", {}, P.pair("thickness", T.number)), P.item("paper", Paper), P.item("title_block", TitleBlock), P.list("layers", T.item(Layer)), P.item("setup", Setup), P.mapped_collection("properties", "property", (p) => p.name, T.item(Property, this)), P.collection("nets", "net", T.item(Net)), P.collection("footprints", "footprint", T.item(Footprint, this)), P.collection("zones", "zone", T.item(Zone)), P.collection("segments", "segment", T.item(LineSegment)), P.collection("segments", "arc", T.item(ArcSegment)), P.collection("vias", "via", T.item(Via)), P.collection("drawings", "dimension", T.item(Dimension, this)), P.collection("drawings", "gr_line", T.item(GrLine)), P.collection("drawings", "gr_circle", T.item(GrCircle)), P.collection("drawings", "gr_arc", T.item(GrArc)), P.collection("drawings", "gr_poly", T.item(GrPoly)), P.collection("drawings", "gr_rect", T.item(GrRect)), P.collection("drawings", "gr_text", T.item(GrText, this)), P.collection("groups", "group", T.item(Group))));
    }
    *items() {
        yield* this.drawings;
        yield* this.vias;
        yield* this.segments;
        yield* this.zones;
        yield* this.footprints;
    }
    resolve_text_var(name) {
        if (name == "FILENAME") {
            return this.filename;
        }
        if (this.properties.has(name)) {
            return this.properties.get(name).value;
        }
        return this.title_block.resolve_text_var(name);
    }
    get edge_cuts_bbox() {
        let bbox = new BBox(0, 0, 0, 0);
        for (const item of this.drawings) {
            if (item.layer != "Edge.Cuts" || !(item instanceof GraphicItem)) {
                continue;
            }
            bbox = BBox.combine([bbox, item.bbox]);
        }
        return bbox;
    }
    find_footprint(uuid_or_ref) {
        for (const fp of this.footprints) {
            if (fp.uuid == uuid_or_ref || fp.reference == uuid_or_ref) {
                return fp;
            }
        }
        return null;
    }
}
export class Property {
    constructor(expr) {
        Object.assign(this, parse_expr(expr, P.start("property"), P.positional("name", T.string), P.positional("value", T.string)));
    }
}
export class LineSegment {
    constructor(expr) {
        this.locked = false;
        /*
        (segment
            (start 119.1 82.943)
            (end 120.0075 82.943)
            (width 0.5)
            (layer "F.Cu")
            (net 1)
            (tstamp 0766ea9a-c430-4922-b68d-6ad9f33e6672))
        */
        Object.assign(this, parse_expr(expr, P.start("segment"), P.vec2("start"), P.vec2("end"), P.pair("width", T.number), P.pair("layer", T.string), P.pair("net", T.number), P.atom("locked"), P.pair("tstamp", T.string)));
    }
}
export class ArcSegment {
    constructor(expr) {
        this.locked = false;
        /*
        (arc
            (start 115.25 59.05)
            (mid 115.301256 58.926256)
            (end 115.425 58.875)
            (width 0.3)
            (layer "F.Cu")
            (net 1)
            (tstamp 1c993ada-29b1-41b2-8ac1-a7f99ad99281))
        */
        Object.assign(this, parse_expr(expr, P.start("arc"), P.vec2("start"), P.vec2("mid"), P.vec2("end"), P.pair("width", T.number), P.pair("layer", T.string), P.pair("net", T.number), P.atom("locked"), P.pair("tstamp", T.string)));
    }
}
export class Via {
    constructor(expr) {
        this.type = "through-hole";
        this.remove_unused_layers = false;
        this.keep_end_layers = false;
        this.locked = false;
        this.free = false;
        Object.assign(this, parse_expr(expr, P.start("via"), P.atom("type", ["blind", "micro", "through-hole"]), P.item("at", At), P.pair("size", T.number), P.pair("drill", T.number), P.list("layers", T.string), P.pair("net", T.number), P.atom("locked"), P.atom("free"), P.atom("remove_unused_layers"), P.atom("keep_end_layers"), P.pair("tstamp", T.string)));
    }
}
export class Zone {
    constructor(expr, parent) {
        this.parent = parent;
        this.locked = false;
        Object.assign(this, parse_expr(expr, P.start("zone"), P.atom("locked"), P.pair("net", T.number), P.pair("net_name", T.string), P.pair("net_name", T.string), P.pair("name", T.string), P.pair("layer", T.string), P.list("layers", T.string), P.object("hatch", {}, P.positional("style", T.string), P.positional("pitch", T.number)), P.pair("priority", T.number), P.object("connect_pads", {}, P.positional("type", T.string), P.pair("clearance", T.number)), P.pair("min_thickness", T.number), P.pair("filled_areas_thickness", T.boolean), P.item("keepout", ZoneKeepout), P.item("fill", ZoneFill), P.collection("polygons", "polygon", T.item(Poly)), P.collection("filled_polygons", "filled_polygon", T.item(FilledPolygon)), P.pair("tstamp", T.string)));
    }
}
export class ZoneKeepout {
    constructor(expr) {
        Object.assign(this, parse_expr(expr, P.start("keepout"), P.pair("tracks", T.string), P.pair("vias", T.string), P.pair("pads", T.string), P.pair("copperpour", T.string), P.pair("footprints", T.string)));
    }
}
export class ZoneFill {
    constructor(expr) {
        this.fill = false;
        this.mode = "solid";
        Object.assign(this, parse_expr(expr, P.start("fill"), P.positional("fill", T.boolean), P.pair("mode", T.string), P.pair("thermal_gap", T.number), P.pair("thermal_bridge_width", T.number), P.expr("smoothing", T.object({}, P.positional("style", T.string), P.pair("radius", T.number))), P.pair("radius", T.number), P.pair("island_removal_mode", T.number), P.pair("island_area_min", T.number), P.pair("hatch_thickness", T.number), P.pair("hatch_gap", T.number), P.pair("hatch_orientation", T.number), P.pair("hatch_smoothing_level", T.number), P.pair("hatch_smoothing_value", T.number), P.pair("hatch_border_algorithm", T.string), P.pair("hatch_min_hole_area", T.number)));
    }
}
export class Layer {
    constructor(expr) {
        Object.assign(this, parse_expr(expr, P.positional("ordinal", T.number), P.positional("canonical_name", T.string), P.positional("type", T.string), P.positional("user_name", T.string)));
    }
}
export class Setup {
    constructor(expr) {
        Object.assign(this, parse_expr(expr, P.start("setup"), P.pair("pad_to_mask_clearance", T.number), P.pair("solder_mask_min_width", T.number), P.pair("pad_to_paste_clearance", T.number), P.pair("pad_to_paste_clearance_ratio", T.number), P.vec2("aux_axis_origin"), P.vec2("grid_origin"), P.item("pcbplotparams", PCBPlotParams), P.item("stackup", Stackup)));
    }
}
export class PCBPlotParams {
    constructor(expr) {
        this.disableapertmacros = false;
        this.usegerberextensions = false;
        this.usegerberattributes = false;
        this.usegerberadvancedattributes = false;
        this.creategerberjobfile = false;
        this.svguseinch = false;
        this.excludeedgelayer = false;
        this.plotframeref = false;
        this.viasonmask = false;
        this.useauxorigin = false;
        this.dxfpolygonmode = false;
        this.dxfimperialunits = false;
        this.dxfusepcbnewfont = false;
        this.psnegative = false;
        this.psa4output = false;
        this.plotreference = false;
        this.plotvalue = false;
        this.plotinvisibletext = false;
        this.sketchpadsonfab = false;
        this.subtractmaskfromsilk = false;
        this.mirror = false;
        Object.assign(this, parse_expr(expr, P.start("pcbplotparams"), P.pair("layerselection", T.number), P.pair("disableapertmacros", T.boolean), P.pair("usegerberextensions", T.boolean), P.pair("usegerberattributes", T.boolean), P.pair("usegerberadvancedattributes", T.boolean), P.pair("creategerberjobfile", T.boolean), P.pair("gerberprecision", T.number), P.pair("svguseinch", T.boolean), P.pair("svgprecision", T.number), P.pair("excludeedgelayer", T.boolean), P.pair("plotframeref", T.boolean), P.pair("viasonmask", T.boolean), P.pair("mode", T.number), P.pair("useauxorigin", T.boolean), P.pair("hpglpennumber", T.number), P.pair("hpglpenspeed", T.number), P.pair("hpglpendiameter", T.number), P.pair("dxfpolygonmode", T.boolean), P.pair("dxfimperialunits", T.boolean), P.pair("dxfusepcbnewfont", T.boolean), P.pair("psnegative", T.boolean), P.pair("psa4output", T.boolean), P.pair("plotreference", T.boolean), P.pair("plotvalue", T.boolean), P.pair("plotinvisibletext", T.boolean), P.pair("sketchpadsonfab", T.boolean), P.pair("subtractmaskfromsilk", T.boolean), P.pair("outputformat", T.number), P.pair("mirror", T.boolean), P.pair("drillshape", T.number), P.pair("scaleselection", T.number), P.pair("outputdirectory", T.string), P.pair("plot_on_all_layers_selection", T.number), P.pair("dashed_line_dash_ratio", T.number), P.pair("dashed_line_gap_ratio", T.number)));
    }
}
export class Stackup {
    constructor(expr) {
        this.dielectric_constraints = false;
        this.castellated_pads = false;
        this.edge_plating = false;
        Object.assign(this, parse_expr(expr, P.start("stackup"), P.pair("copper_finish", T.string), P.pair("dielectric_constraints", T.boolean), P.pair("edge_connector", T.string), P.pair("castellated_pads", T.boolean), P.pair("edge_plating", T.boolean), P.collection("layers", "layer", T.item(StackupLayer))));
    }
}
export class StackupLayer {
    constructor(expr) {
        Object.assign(this, parse_expr(expr, P.start("layer"), P.positional("name", T.string), P.pair("type", T.string), P.pair("color", T.string), P.pair("thickness", T.number), P.pair("material", T.string), P.pair("epsilon_r", T.number), P.pair("loss_tangent", T.number)));
    }
}
export class Net {
    constructor(expr) {
        // (net 2 "+3V3")
        Object.assign(this, parse_expr(expr, P.start("net"), P.positional("number", T.number), P.positional("name", T.string)));
    }
}
export class Dimension {
    constructor(expr, parent) {
        this.parent = parent;
        this.locked = false;
        Object.assign(this, parse_expr(expr, P.start("dimension"), P.atom("locked"), P.pair("type", T.string), P.pair("layer", T.string), P.pair("tstamp", T.string), P.list("pts", T.vec2), P.pair("height", T.number), P.pair("orientation", T.number), P.pair("leader_length", T.number), P.item("gr_text", GrText, this), P.item("format", DimensionFormat), P.item("style", DimensionStyle)));
    }
    resolve_text_var(name) {
        return this.parent.resolve_text_var(name);
    }
    get start() {
        return this.pts.at(0) ?? new Vec2(0, 0);
    }
    get end() {
        return this.pts.at(-1) ?? new Vec2(0, 0);
    }
}
export var DimensionFormatUnits;
(function (DimensionFormatUnits) {
    DimensionFormatUnits[DimensionFormatUnits["inches"] = 0] = "inches";
    DimensionFormatUnits[DimensionFormatUnits["mils"] = 1] = "mils";
    DimensionFormatUnits[DimensionFormatUnits["millimeters"] = 2] = "millimeters";
    DimensionFormatUnits[DimensionFormatUnits["automatic"] = 3] = "automatic";
})(DimensionFormatUnits || (DimensionFormatUnits = {}));
export var DimensionFormatUnitsFormat;
(function (DimensionFormatUnitsFormat) {
    DimensionFormatUnitsFormat[DimensionFormatUnitsFormat["none"] = 0] = "none";
    DimensionFormatUnitsFormat[DimensionFormatUnitsFormat["bare"] = 1] = "bare";
    DimensionFormatUnitsFormat[DimensionFormatUnitsFormat["parenthesis"] = 2] = "parenthesis";
})(DimensionFormatUnitsFormat || (DimensionFormatUnitsFormat = {}));
export class DimensionFormat {
    constructor(expr) {
        this.suppress_zeroes = false;
        Object.assign(this, parse_expr(expr, P.start("format"), P.pair("prefix", T.string), P.pair("suffix", T.string), P.pair("units", T.number), P.pair("units_format", T.number), P.pair("precision", T.number), P.pair("override_value", T.string), P.atom("suppress_zeroes")));
    }
}
export var DimensionStyleTextPositionMode;
(function (DimensionStyleTextPositionMode) {
    DimensionStyleTextPositionMode[DimensionStyleTextPositionMode["outside"] = 0] = "outside";
    DimensionStyleTextPositionMode[DimensionStyleTextPositionMode["inline"] = 1] = "inline";
    DimensionStyleTextPositionMode[DimensionStyleTextPositionMode["manual"] = 2] = "manual";
})(DimensionStyleTextPositionMode || (DimensionStyleTextPositionMode = {}));
export var DimensionStyleTextFrame;
(function (DimensionStyleTextFrame) {
    DimensionStyleTextFrame[DimensionStyleTextFrame["none"] = 0] = "none";
    DimensionStyleTextFrame[DimensionStyleTextFrame["rect"] = 1] = "rect";
    DimensionStyleTextFrame[DimensionStyleTextFrame["circle"] = 2] = "circle";
    DimensionStyleTextFrame[DimensionStyleTextFrame["roundrect"] = 3] = "roundrect";
})(DimensionStyleTextFrame || (DimensionStyleTextFrame = {}));
export class DimensionStyle {
    constructor(expr) {
        Object.assign(this, parse_expr(expr, P.start("style"), P.pair("thickness", T.number), P.pair("arrow_length", T.number), P.pair("text_position_mode", T.number), P.pair("extension_height", T.number), P.pair("text_frame", T.number), P.pair("extension_offset", T.number), P.atom("keep_text_aligned")));
    }
}
export class Footprint {
    #pads_by_number;
    #bbox;
    constructor(expr, parent) {
        this.parent = parent;
        this.locked = false;
        this.placed = false;
        this.attr = {
            through_hole: false,
            smd: false,
            virtual: false,
            board_only: false,
            exclude_from_pos_files: false,
            exclude_from_bom: false,
            allow_solder_mask_bridges: false,
            allow_missing_courtyard: false,
        };
        this.properties = {};
        this.drawings = [];
        this.pads = [];
        this.#pads_by_number = new Map();
        this.zones = [];
        this.models = [];
        Object.assign(this, parse_expr(expr, P.start("footprint"), P.positional("library_link", T.string), P.pair("version", T.number), P.pair("generator", T.string), P.atom("locked"), P.atom("placed"), P.pair("layer", T.string), P.pair("tedit", T.string), P.pair("tstamp", T.string), P.item("at", At), P.pair("descr", T.string), P.pair("tags", T.string), P.pair("path", T.string), P.pair("autoplace_cost90", T.number), P.pair("autoplace_cost180", T.number), P.pair("solder_mask_margin", T.number), P.pair("solder_paste_margin", T.number), P.pair("solder_paste_ratio", T.number), P.pair("clearance", T.number), P.pair("zone_connect", T.number), P.pair("thermal_width", T.number), P.pair("thermal_gap", T.number), P.object("attr", this.attr, P.atom("through_hole"), P.atom("smd"), P.atom("virtual"), P.atom("board_only"), P.atom("exclude_from_pos_files"), P.atom("exclude_from_bom"), P.atom("allow_solder_mask_bridges"), P.atom("allow_missing_courtyard")), P.dict("properties", "property", T.string), P.collection("drawings", "fp_line", T.item(FpLine, this)), P.collection("drawings", "fp_circle", T.item(FpCircle, this)), P.collection("drawings", "fp_arc", T.item(FpArc, this)), P.collection("drawings", "fp_poly", T.item(FpPoly, this)), P.collection("drawings", "fp_rect", T.item(FpRect, this)), P.collection("drawings", "fp_text", T.item(FpText, this)), P.collection("zones", "zone", T.item(Zone, this)), P.collection("models", "model", T.item(Model)), P.collection("pads", "pad", T.item(Pad, this))));
        for (const pad of this.pads) {
            this.#pads_by_number.set(pad.number, pad);
        }
        for (const d of this.drawings) {
            if (!(d instanceof FpText)) {
                continue;
            }
            if (d.type == "reference") {
                this.reference = d.text;
            }
            if (d.type == "value") {
                this.value = d.text;
            }
        }
    }
    get uuid() {
        return this.tstamp;
    }
    *items() {
        yield* this.drawings ?? [];
        yield* this.zones ?? [];
        yield* this.pads.values() ?? [];
    }
    resolve_text_var(name) {
        switch (name) {
            case "REFERENCE":
                return this.reference;
            case "VALUE":
                return this.value;
            case "LAYER":
                return this.layer;
            case "FOOTPRINT_LIBRARY":
                return this.library_link.split(":").at(0);
            case "FOOTPRINT_NAME":
                return this.library_link.split(":").at(-1);
        }
        const pad_expr = /^(NET_NAME|NET_CLASS|PIN_NAME)\(.+?\)$/.exec(name);
        if (pad_expr?.length == 3) {
            const [_, expr_type, pad_name] = pad_expr;
            switch (expr_type) {
                case "NET_NAME":
                    return this.pad_by_number(pad_name)?.net.number.toString();
                case "NET_CLASS":
                    return this.pad_by_number(pad_name)?.net.name;
                case "PIN_NAME":
                    return this.pad_by_number(pad_name)?.pinfunction;
            }
        }
        if (this.properties[name] !== undefined) {
            return this.properties[name];
        }
        return this.parent.resolve_text_var(name);
    }
    pad_by_number(number) {
        return this.#pads_by_number.get(number);
    }
    /**
     * Get the nominal bounding box for this footprint.
     *
     * This does not take into account text drawings.
     */
    get bbox() {
        if (!this.#bbox) {
            // Based on FOOTPRINT::GetBoundingBox, excludes text items.
            // start with a small bbox centered on the footprint's position,
            // so that even if there aren't any items there's still *some*
            // footprint.
            let bbox = new BBox(this.at.position.x - 0.25, this.at.position.y - 0.25, 0.5, 0.5);
            const matrix = Matrix3.translation(this.at.position.x, this.at.position.y).rotate_self(Angle.deg_to_rad(this.at.rotation));
            for (const item of this.drawings) {
                if (item instanceof FpText) {
                    continue;
                }
                bbox = BBox.combine([bbox, item.bbox.transform(matrix)]);
            }
            bbox.context = this;
            this.#bbox = bbox;
        }
        return this.#bbox;
    }
}
class GraphicItem {
    constructor() {
        this.locked = false;
    }
    /**
     * Get the nominal bounding box for the item. This does not include any
     * stroke or other expansion.
     */
    get bbox() {
        return new BBox(0, 0, 0, 0);
    }
}
export class Line extends GraphicItem {
    static { this.expr_start = "unset"; }
    constructor(expr, parent) {
        super();
        this.parent = parent;
        const static_this = this.constructor;
        Object.assign(this, parse_expr(expr, P.start(static_this.expr_start), P.atom("locked"), P.pair("layer", T.string), P.vec2("start"), P.vec2("end"), P.pair("width", T.number), P.pair("tstamp", T.string), P.item("stroke", Stroke)));
        this.width ??= this.stroke?.width || 0;
    }
    get bbox() {
        return BBox.from_points([this.start, this.end]);
    }
}
export class GrLine extends Line {
    static { this.expr_start = "gr_line"; }
}
export class FpLine extends Line {
    static { this.expr_start = "fp_line"; }
}
export class Circle extends GraphicItem {
    static { this.expr_start = "unset"; }
    constructor(expr, parent) {
        super();
        this.parent = parent;
        const static_this = this.constructor;
        Object.assign(this, parse_expr(expr, P.start(static_this.expr_start), P.atom("locked"), P.vec2("center"), P.vec2("end"), P.pair("width", T.number), P.pair("fill", T.string), P.pair("layer", T.string), P.pair("tstamp", T.string), P.item("stroke", Stroke)));
        this.width ??= this.stroke?.width || 0;
    }
    get bbox() {
        const radius = this.center.sub(this.end).magnitude;
        const radial = new Vec2(radius, radius);
        return BBox.from_points([
            this.center.sub(radial),
            this.center.add(radial),
        ]);
    }
}
export class GrCircle extends Circle {
    static { this.expr_start = "gr_circle"; }
}
export class FpCircle extends Circle {
    static { this.expr_start = "fp_circle"; }
}
export class Arc extends GraphicItem {
    static { this.expr_start = "unset"; }
    #arc;
    constructor(expr, parent) {
        super();
        this.parent = parent;
        const static_this = this.constructor;
        const parsed = parse_expr(expr, P.start(static_this.expr_start), P.atom("locked"), P.pair("layer", T.string), P.vec2("start"), P.vec2("mid"), P.vec2("end"), P.pair("angle", T.number), P.pair("width", T.number), P.pair("tstamp", T.string), P.item("stroke", Stroke));
        // Handle old format.
        // See LEGACY_ARC_FORMATTING and EDA_SHAPE::SetArcAngleAndEnd
        if (parsed["angle"] !== undefined) {
            const angle = Angle.from_degrees(parsed["angle"]).normalize720();
            const center = parsed["start"];
            let start = parsed["end"];
            let end = angle.negative().rotate_point(start, center);
            if (angle.degrees < 0) {
                [start, end] = [end, start];
            }
            this.#arc = MathArc.from_center_start_end(center, start, end, parsed["width"]);
            parsed["start"] = this.#arc.start_point;
            parsed["mid"] = this.#arc.mid_point;
            parsed["end"] = this.#arc.end_point;
            delete parsed["angle"];
        }
        else {
            this.#arc = MathArc.from_three_points(parsed["start"], parsed["mid"], parsed["end"], parsed["width"]);
        }
        Object.assign(this, parsed);
        this.width ??= this.stroke?.width ?? this.#arc.width;
        this.#arc.width = this.width;
    }
    get arc() {
        return this.#arc;
    }
    get bbox() {
        return this.arc.bbox;
    }
}
export class GrArc extends Arc {
    static { this.expr_start = "gr_arc"; }
}
export class FpArc extends Arc {
    static { this.expr_start = "fp_arc"; }
}
export class Poly extends GraphicItem {
    static { this.expr_start = "polygon"; }
    constructor(expr, parent) {
        super();
        this.parent = parent;
        const static_this = this.constructor;
        Object.assign(this, parse_expr(expr, P.start(static_this.expr_start), P.atom("locked"), P.pair("layer", T.string), P.atom("island"), P.list("pts", T.vec2), P.pair("width", T.number), P.pair("fill", T.string), P.pair("tstamp", T.string), P.item("stroke", Stroke)));
        this.width ??= this.stroke?.width || 0;
    }
    get bbox() {
        return BBox.from_points(this.pts);
    }
}
export class FilledPolygon extends Poly {
    static { this.expr_start = "filled_polygon"; }
}
export class GrPoly extends Poly {
    static { this.expr_start = "gr_poly"; }
}
export class FpPoly extends Poly {
    static { this.expr_start = "fp_poly"; }
}
export class Rect extends GraphicItem {
    static { this.expr_start = "rect"; }
    constructor(expr, parent) {
        super();
        this.parent = parent;
        const static_this = this.constructor;
        Object.assign(this, parse_expr(expr, P.start(static_this.expr_start), P.atom("locked"), P.vec2("start"), P.vec2("end"), P.pair("layer", T.string), P.pair("width", T.number), P.pair("fill", T.string), P.pair("tstamp", T.string), P.item("stroke", Stroke)));
        this.width ??= this.stroke?.width || 0;
    }
    get bbox() {
        return BBox.from_points([this.start, this.end]);
    }
}
export class GrRect extends Rect {
    static { this.expr_start = "gr_rect"; }
}
export class FpRect extends Rect {
    static { this.expr_start = "fp_rect"; }
}
export class TextRenderCache {
    constructor(expr) {
        Object.assign(this, parse_expr(expr, P.start("render_cache"), P.positional("text", T.string), P.positional("angle", T.number), P.collection("polygons", "polygon", T.item(Poly))));
        for (const poly of this.polygons) {
            poly.fill = "solid";
        }
    }
}
export class Text {
    constructor() {
        this.unlocked = false;
        this.hide = false;
        this.effects = new Effects();
    }
    static { this.common_expr_defs = [
        P.item("at", At),
        P.atom("hide"),
        P.atom("unlocked"),
        P.object("layer", {}, P.positional("name", T.string), P.atom("knockout")),
        P.pair("tstamp", T.string),
        P.item("effects", Effects),
        P.item("render_cache", TextRenderCache),
    ]; }
    get shown_text() {
        return expand_text_vars(this.text, this.parent);
    }
}
export class FpText extends Text {
    constructor(expr, parent) {
        super();
        this.parent = parent;
        this.locked = false;
        Object.assign(this, parse_expr(expr, P.start("fp_text"), P.atom("locked"), P.positional("type", T.string), P.positional("text", T.string), ...Text.common_expr_defs));
    }
}
export class GrText extends Text {
    constructor(expr, parent) {
        super();
        this.parent = parent;
        this.locked = false;
        Object.assign(this, parse_expr(expr, P.start("gr_text"), P.atom("locked"), P.positional("text", T.string), ...Text.common_expr_defs));
    }
}
export class Pad {
    constructor(expr, parent) {
        this.parent = parent;
        this.type = "thru_hole";
        this.locked = false;
        const parsed = parse_expr(expr, P.start("pad"), P.positional("number", T.string), P.positional("type", T.string), P.positional("shape", T.string), P.item("at", At), P.atom("locked"), P.vec2("size"), P.vec2("rect_delta"), P.list("layers", T.string), P.pair("roundrect_rratio", T.number), P.pair("chamfer_ratio", T.number), P.expr("chamfer", T.object({}, P.atom("top_right"), P.atom("top_left"), P.atom("bottom_right"), P.atom("bottom_left"))), P.pair("pinfunction", T.string), P.pair("pintype", T.string), P.pair("solder_mask_margin", T.number), P.pair("solder_paste_margin", T.number), P.pair("solder_paste_margin_ratio", T.number), P.pair("clearance", T.number), P.pair("thermal_width", T.number), P.pair("thermal_gap", T.number), P.pair("thermal_bridge_angle", T.number), P.pair("zone_connect", T.number), P.pair("tstamp", T.string), P.item("drill", PadDrill), P.item("net", Net), P.item("options", PadOptions), P.expr("primitives", (obj, name, expr) => {
            const parsed = parse_expr(expr, P.start("primitives"), P.collection("items", "gr_line", T.item(GrLine, this)), P.collection("items", "gr_circle", T.item(GrCircle, this)), P.collection("items", "gr_arc", T.item(GrArc, this)), P.collection("items", "gr_rect", T.item(GrRect, this)), P.collection("items", "gr_poly", T.item(GrPoly, this)));
            return parsed?.["items"];
        }));
        Object.assign(this, parsed);
    }
}
export class PadDrill {
    constructor(expr) {
        this.oval = false;
        this.diameter = 0;
        this.width = 0;
        this.offset = new Vec2(0, 0);
        Object.assign(this, parse_expr(expr, P.start("drill"), P.atom("oval"), P.positional("diameter", T.number), P.positional("width", T.number), P.vec2("offset")));
    }
}
export class PadOptions {
    constructor(expr) {
        Object.assign(this, parse_expr(expr, P.start("options"), P.pair("clearance", T.string), P.pair("anchor", T.string)));
    }
}
export class Model {
    constructor(expr) {
        this.hide = false;
        this.opacity = 1;
        Object.assign(this, parse_expr(expr, P.start("model"), P.positional("filename", T.string), P.atom("hide"), P.pair("opacity", T.number), P.object("offset", {}, P.list("xyz", T.number)), P.object("scale", {}, P.list("xyz", T.number)), P.object("rotate", {}, P.list("xyz", T.number))));
    }
}
export class Group {
    constructor(expr) {
        this.locked = false;
        Object.assign(this, parse_expr(expr, P.start("group"), P.positional("name", T.string), P.atom("locked"), P.pair("id", T.string), P.list("members", T.string)));
    }
}
