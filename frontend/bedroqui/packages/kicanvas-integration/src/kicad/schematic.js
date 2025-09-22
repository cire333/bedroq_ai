/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import * as log from "../base/log";
import { Arc as MathArc } from "../base/math";
import { At, Effects, Paper, Stroke, TitleBlock, expand_text_vars, unescape_string, } from "./common";
import { P, T, parse_expr } from "./parser";
/* Default values for various things found in schematics
 * From EESchema's default_values.h, converted from mils to mm. */
export const DefaultValues = {
    /* The size of the rectangle indicating an unconnected wire or label */
    dangling_symbol_size: 0.3048,
    /* The size of the rectangle indicating a connected, unselected wire end */
    unselected_end_size: 0.1016,
    pin_length: 2.54,
    pinsymbol_size: 0.635,
    pinnum_size: 1.27,
    pinname_size: 1.27,
    selection_thickness: 0.0762,
    line_width: 0.1524,
    wire_width: 0.1524,
    bus_width: 0.3048,
    noconnect_size: 1.2192,
    junction_diameter: 0.9144,
    target_pin_radius: 0.381,
    /* The default bus and wire entry size. */
    sch_entry_size: 2.54,
    text_size: 1.27,
    /* Ratio of the font height to the baseline of the text above the wire. */
    text_offset_ratio: 0.15,
    /* Ratio of the font height to space around global labels */
    label_size_ratio: 0.375,
    /* The offset of the pin name string from the end of the pin in mils. */
    pin_name_offset: 0.508, // 20 mils
};
export class KicadSch {
    constructor(filename, expr) {
        this.filename = filename;
        this.title_block = new TitleBlock();
        this.wires = [];
        this.buses = [];
        this.bus_entries = [];
        this.bus_aliases = [];
        this.junctions = [];
        this.net_labels = [];
        this.global_labels = [];
        this.hierarchical_labels = [];
        this.symbols = new Map();
        this.no_connects = [];
        this.drawings = [];
        this.images = [];
        this.sheets = [];
        Object.assign(this, parse_expr(expr, P.start("kicad_sch"), P.pair("version", T.number), P.pair("generator", T.string), P.pair("uuid", T.string), P.item("paper", Paper), P.item("title_block", TitleBlock), P.item("lib_symbols", LibSymbols, this), P.collection("wires", "wire", T.item(Wire)), P.collection("buses", "bus", T.item(Bus)), P.collection("bus_entries", "bus_entry", T.item(BusEntry)), P.collection("bus_aliases", "bus_alias", T.item(BusAlias)), P.collection("junctions", "junction", T.item(Junction)), P.collection("no_connects", "no_connect", T.item(NoConnect)), P.collection("net_labels", "label", T.item(NetLabel)), P.collection("global_labels", "global_label", T.item(GlobalLabel, this)), P.collection("hierarchical_labels", "hierarchical_label", T.item(HierarchicalLabel, this)), 
        // images
        P.mapped_collection("symbols", "symbol", (p) => p.uuid, T.item(SchematicSymbol, this)), P.collection("drawings", "polyline", T.item(Polyline, this)), P.collection("drawings", "rectangle", T.item(Rectangle, this)), P.collection("drawings", "arc", T.item(Arc, this)), P.collection("drawings", "text", T.item(Text, this)), P.collection("images", "image", T.item(Image)), P.item("sheet_instances", SheetInstances), P.item("symbol_instances", SymbolInstances), P.collection("sheets", "sheet", T.item(SchematicSheet, this))));
        this.update_hierarchical_data();
    }
    update_hierarchical_data(path) {
        // Assigns SchematicSymbol properties based on data in symbol_instances,
        // used for differing values in hierarchical sheet instances.
        // See SCH_SHEET_LIST::UpdateSymbolInstanceData
        path ??= ``;
        const root_symbol_instances = this.project?.root_schematic_page?.document?.symbol_instances;
        const global_symbol_instances = this.symbol_instances;
        for (const s of this.symbols.values()) {
            const symbol_path = `${path}/${s.uuid}`;
            const instance_data = root_symbol_instances?.get(symbol_path) ??
                global_symbol_instances?.get(symbol_path) ??
                s.instances.get(path);
            if (!instance_data) {
                continue;
            }
            s.reference = instance_data.reference ?? s.reference;
            s.value = instance_data.value ?? s.value;
            s.footprint = instance_data.footprint ?? s.footprint;
            s.unit = instance_data.unit ?? s.unit;
        }
        // See SCH_SHEET_LIST::UpdateSheetInstanceData
        const root_sheet_instances = this.project?.root_schematic_page?.document?.sheet_instances;
        const global_sheet_instances = this.sheet_instances;
        for (const s of this.sheets) {
            const sheet_path = `${path}/${s.uuid}`;
            const instance_data = root_sheet_instances?.get(sheet_path) ??
                global_sheet_instances?.get(sheet_path) ??
                s.instances.get(path);
            if (!instance_data) {
                continue;
            }
            s.page = instance_data.page;
            s.path = instance_data.path;
            if (!s.instances.size) {
                const inst = new SchematicSheetInstance();
                inst.page = instance_data.page;
                inst.path = instance_data.path;
                s.instances.set("", inst);
            }
        }
    }
    *items() {
        yield* this.wires;
        yield* this.buses;
        yield* this.bus_entries;
        yield* this.junctions;
        yield* this.net_labels;
        yield* this.global_labels;
        yield* this.hierarchical_labels;
        yield* this.no_connects;
        yield* this.symbols.values();
        yield* this.drawings;
        yield* this.images;
        yield* this.sheets;
    }
    find_symbol(uuid_or_ref) {
        if (this.symbols.has(uuid_or_ref)) {
            return this.symbols.get(uuid_or_ref);
        }
        for (const sym of this.symbols.values()) {
            if (sym.uuid == uuid_or_ref || sym.reference == uuid_or_ref) {
                return sym;
            }
        }
        return null;
    }
    find_sheet(uuid) {
        for (const sheet of this.sheets) {
            if (sheet.uuid == uuid) {
                return sheet;
            }
        }
        return null;
    }
    resolve_text_var(name) {
        if (name == "FILENAME") {
            return this.filename;
        }
        // Cross-reference
        if (name.includes(":")) {
            const [uuid, field_name] = name.split(":");
            const symbol = this.symbols.get(uuid);
            if (symbol) {
                return symbol.resolve_text_var(field_name);
            }
        }
        return this.title_block.resolve_text_var(name);
    }
}
export class Fill {
    constructor(expr) {
        /* (fill (type none)) */
        Object.assign(this, parse_expr(expr, P.start("fill"), P.pair("type", T.string), P.color()));
    }
}
export class GraphicItem {
    constructor(parent) {
        this.private = false;
        this.parent = parent;
    }
    static { this.common_expr_defs = [
        P.atom("private"),
        P.item("stroke", Stroke),
        P.item("fill", Fill),
        P.pair("uuid", T.string),
    ]; }
}
export class Wire {
    constructor(expr) {
        /* (wire (pts (xy 43.18 195.58) (xy 31.75 195.58))
            (stroke (width 0) (type default) (color 0 0 0 0))
            (uuid 038156ee-7718-4322-b7b7-38f0697322c2)) */
        Object.assign(this, parse_expr(expr, P.start("wire"), P.list("pts", T.vec2), P.item("stroke", Stroke), P.pair("uuid", T.string)));
    }
}
export class Bus {
    constructor(expr) {
        /* (bus (pts (xy 43.18 195.58) (xy 31.75 195.58))
            (stroke (width 0) (type default) (color 0 0 0 0))
            (uuid 038156ee-7718-4322-b7b7-38f0697322c2)) */
        Object.assign(this, parse_expr(expr, P.start("bus"), P.list("pts", T.vec2), P.item("stroke", Stroke), P.pair("uuid", T.string)));
    }
}
export class BusEntry {
    constructor(expr) {
        /* (bus_entry (at 10 0) (size 2.54 2.54)
            (stroke (width 0) (type default) (color 0 0 0 0))
            (uuid 3b641c0a-296a-4bcf-b805-e697e8b794d1))*/
        Object.assign(this, parse_expr(expr, P.start("bus_entry"), P.item("at", At), P.vec2("size"), P.item("stroke", Stroke), P.pair("uuid", T.string)));
    }
}
export class BusAlias {
    constructor(expr) {
        this.members = [];
        /* (bus_alias "abusalias" (members "member1" "member2")) */
        Object.assign(this, parse_expr(expr, P.start("bus_alias"), P.list("members", T.string)));
    }
}
export class Junction {
    constructor(expr) {
        /* (junction (at 179.07 95.885) (diameter 0) (color 0 0 0 0)
            (uuid 0650c6c5-fcca-459c-82ef-4388c8242b9d)) */
        Object.assign(this, parse_expr(expr, P.start("junction"), P.item("at", At), P.pair("diameter", T.number), P.color(), P.pair("uuid", T.string)));
    }
}
export class NoConnect {
    constructor(expr) {
        /* (no_connect (at 236.22 92.71) (uuid f51df0a0-a355-457d-a756-de88302995ad)) */
        Object.assign(this, parse_expr(expr, P.start("no_connect"), P.item("at", At), P.pair("uuid", T.string)));
    }
}
export class Arc extends GraphicItem {
    constructor(expr, parent) {
        /*
        Current form:
        (arc (start 2.032 -1.27) (mid 0 -0.5572) (end -2.032 -1.27)
          (stroke (width 0.508) (type default) (color 0 0 0 0))
          (fill (type none)))

        Previous form:
        (arc (start -0.254 1.016) (end -0.254 -1.016)
          (radius (at -0.254 0) (length 1.016) (angles 90.1 -90.1))
          (stroke (width 0)) (fill(type none)))
        */
        super(parent);
        const parsed = parse_expr(expr, P.start("arc"), P.vec2("start"), P.vec2("mid"), P.vec2("end"), P.object("radius", {}, P.start("radius"), P.vec2("at"), P.pair("length"), P.vec2("angles")), ...GraphicItem.common_expr_defs);
        // Deal with old format
        if (parsed["radius"]?.["length"]) {
            const arc = MathArc.from_center_start_end(parsed["radius"]["at"], parsed["end"], parsed["start"], 1);
            if (arc.arc_angle.degrees > 180) {
                [arc.start_angle, arc.end_angle] = [
                    arc.end_angle,
                    arc.start_angle,
                ];
            }
            parsed["start"] = arc.start_point;
            parsed["mid"] = arc.mid_point;
            parsed["end"] = arc.end_point;
        }
        delete parsed["radius"];
        Object.assign(this, parsed);
    }
}
export class Bezier extends GraphicItem {
    constructor(expr, parent) {
        /* TODO: this was added in KiCAD 7 */
        super(parent);
        Object.assign(this, parse_expr(expr, P.start("bezier"), P.list("pts", T.vec2), ...GraphicItem.common_expr_defs));
    }
    get start() {
        return this.pts[0];
    }
    get c1() {
        return this.pts[1];
    }
    get c2() {
        return this.pts[2];
    }
    get end() {
        return this.pts[3];
    }
}
export class Circle extends GraphicItem {
    constructor(expr, parent) {
        /*
        (circle (center 0 0) (radius 0.508)
          (stroke (width 0) (type default) (color 0 0 0 0))
          (fill (type none)))
        */
        super(parent);
        Object.assign(this, parse_expr(expr, P.start("circle"), P.vec2("center"), P.pair("radius", T.number), ...GraphicItem.common_expr_defs));
    }
}
export class Polyline extends GraphicItem {
    constructor(expr, parent) {
        /*
        (polyline
          (pts
            (xy -1.524 -0.508)
            (xy 1.524 -0.508))
          (stroke (width 0.3302) (type default) (color 0 0 0 0))
          (fill (type none)))
        */
        super(parent);
        Object.assign(this, parse_expr(expr, P.start("polyline"), P.list("pts", T.vec2), ...GraphicItem.common_expr_defs));
    }
}
export class Rectangle extends GraphicItem {
    constructor(expr, parent) {
        /*
        (rectangle (start -10.16 7.62) (end 10.16 -7.62)
          (stroke (width 0.254) (type default) (color 0 0 0 0))
          (fill (type background)))
        */
        super(parent);
        Object.assign(this, parse_expr(expr, P.start("rectangle"), P.vec2("start"), P.vec2("end"), ...GraphicItem.common_expr_defs));
    }
}
export class Image {
    constructor(expr) {
        Object.assign(this, parse_expr(expr, P.start("image"), P.item("at", At), P.pair("data", T.string), P.pair("uuid", T.string)));
    }
}
export class Text {
    constructor(expr, parent) {
        this.parent = parent;
        this.private = false;
        this.effects = new Effects();
        /*
        (text "SWD" (at -5.08 0 900)
          (effects (font (size 2.54 2.54))))
        */
        Object.assign(this, parse_expr(expr, P.start("text"), P.positional("text"), P.item("at", At), P.item("effects", Effects), P.pair("uuid", T.string)));
        // Remove trailing \n on text
        if (this.text.endsWith("\n")) {
            this.text = this.text.slice(0, this.text.length - 1);
        }
    }
    get shown_text() {
        return expand_text_vars(this.text, this.parent);
    }
}
export class LibText extends Text {
    constructor(expr, parent) {
        super(expr, parent);
        this.parent = parent;
        if (parent instanceof LibSymbol || parent instanceof SchematicSymbol) {
            // From sch_sexpr_parser.cpp:LIB_TEXT* SCH_SEXPR_PARSER::parseText()
            // "Yes, LIB_TEXT is really decidegrees even though all the others are degrees. :("
            // motherfuck.
            this.at.rotation /= 10;
        }
    }
}
export class TextBox extends GraphicItem {
    constructor(expr, parent) {
        /* TODO: This was added in KiCAD 7 */
        super(parent);
        this.effects = new Effects();
        Object.assign(this, parse_expr(expr, P.start("text"), P.positional("text"), P.item("at", At), P.vec2("size"), P.item("effects", Effects), ...GraphicItem.common_expr_defs));
    }
}
export class Label {
    constructor() {
        this.private = false;
        this.at = new At();
        this.effects = new Effects();
        this.fields_autoplaced = false;
    }
    static { this.common_expr_defs = [
        P.positional("text"),
        P.item("at", At),
        P.item("effects", Effects),
        P.atom("fields_autoplaced"),
        P.pair("uuid", T.string),
    ]; }
    get shown_text() {
        return unescape_string(this.text);
    }
}
export class NetLabel extends Label {
    constructor(expr) {
        /* (label "net label 2.54" (at 10 12 0)
            (effects (font (size 2.54 2.54)) (justify left bottom))
            (uuid 7c29627e-5d2a-4966-8e8b-eadd9d1e6530)) */
        super();
        Object.assign(this, parse_expr(expr, P.start("label"), ...Label.common_expr_defs));
    }
}
export class GlobalLabel extends Label {
    constructor(expr) {
        /* (global_label "global label tri state" (shape tri_state)
            (at 10 25 0) (fields_autoplaced)
            (effects (font (size 1.27 1.27)) (justify left))
            (uuid 1e3e64a3-cedc-4434-ab25-d00014c1e69d)
            (property "Intersheet References" "${INTERSHEET_REFS}" (id 0) (at 32.7936 24.9206 0)
            (effects (font (size 1.27 1.27)) (justify left) hide))) */
        super();
        this.shape = "input";
        this.properties = [];
        Object.assign(this, parse_expr(expr, P.start("global_label"), ...Label.common_expr_defs, P.pair("shape", T.string), P.collection("properties", "property", T.item(Property))));
    }
}
export class HierarchicalLabel extends Label {
    constructor(expr) {
        /* (hierarchical_label "h label passive" (shape passive) (at 18 30 270)
            (effects (font (size 1.27 1.27) (thickness 0.254) bold) (justify right))
            (uuid 484b38aa-713f-4f24-9fa1-63547d78e1da)) */
        super();
        this.shape = "input";
        if (expr) {
            Object.assign(this, parse_expr(expr, P.start("hierarchical_label"), ...Label.common_expr_defs, P.pair("shape", T.string)));
        }
    }
}
export class LibSymbols {
    #symbols_by_name;
    constructor(expr, parent) {
        this.parent = parent;
        this.symbols = [];
        this.#symbols_by_name = new Map();
        Object.assign(this, parse_expr(expr, P.start("lib_symbols"), P.collection("symbols", "symbol", T.item(LibSymbol, parent))));
        for (const symbol of this.symbols) {
            this.#symbols_by_name.set(symbol.name, symbol);
        }
    }
    by_name(name) {
        return this.#symbols_by_name.get(name);
    }
}
export class LibSymbol {
    #pins_by_number;
    #properties_by_id;
    constructor(expr, parent) {
        this.parent = parent;
        this.power = false;
        this.pin_numbers = { hide: false };
        this.pin_names = {
            offset: DefaultValues.pin_name_offset,
            hide: false,
        };
        this.in_bom = false;
        this.on_board = false;
        this.properties = new Map();
        this.children = [];
        this.drawings = [];
        this.pins = [];
        this.units = new Map();
        this.#pins_by_number = new Map();
        this.#properties_by_id = new Map();
        Object.assign(this, parse_expr(expr, P.start("symbol"), P.positional("name"), P.atom("power"), P.object("pin_numbers", this.pin_numbers, P.atom("hide")), P.object("pin_names", this.pin_names, P.pair("offset", T.number), P.atom("hide")), P.pair("in_bom", T.boolean), P.pair("on_board", T.boolean), P.mapped_collection("properties", "property", (p) => p.name, T.item(Property, this)), P.collection("pins", "pin", T.item(PinDefinition, this)), P.collection("children", "symbol", T.item(LibSymbol, this)), P.collection("drawings", "arc", T.item(Arc, this)), P.collection("drawings", "bezier", T.item(Bezier, this)), P.collection("drawings", "circle", T.item(Circle, this)), P.collection("drawings", "polyline", T.item(Polyline, this)), P.collection("drawings", "rectangle", T.item(Rectangle, this)), P.collection("drawings", "text", T.item(LibText, this)), P.collection("drawings", "textbox", T.item(TextBox, this))));
        for (const pin of this.pins) {
            this.#pins_by_number.set(pin.number.text, pin);
        }
        for (const property of this.properties.values()) {
            this.#properties_by_id.set(property.id, property);
        }
        for (const child of this.children) {
            const unit_num = child.unit;
            if (unit_num !== null) {
                const list = this.units.get(unit_num) ?? [];
                list.push(child);
                this.units.set(unit_num, list);
            }
        }
    }
    get root() {
        if (this.parent instanceof LibSymbol) {
            return this.parent.root;
        }
        return this;
    }
    has_pin(number) {
        return this.#pins_by_number.has(number);
    }
    pin_by_number(number, style = 1) {
        if (this.has_pin(number)) {
            return this.#pins_by_number.get(number);
        }
        for (const child of this.children) {
            if ((child.style == 0 || child.style == style) &&
                child.has_pin(number)) {
                return child.pin_by_number(number);
            }
        }
        throw new Error(`No pin numbered ${number} on library symbol ${this.name}`);
    }
    has_property_with_id(id) {
        return this.#properties_by_id.has(id);
    }
    property_by_id(id) {
        if (this.#properties_by_id.has(id)) {
            return this.#properties_by_id.get(id);
        }
        for (const child of this.children) {
            if (child.has_property_with_id(id)) {
                return child.property_by_id(id);
            }
        }
        return null;
    }
    get library_name() {
        if (this.name.includes(":")) {
            return this.name.split(":").at(0);
        }
        return "";
    }
    get library_item_name() {
        if (this.name.includes(":")) {
            return this.name.split(":").at(1);
        }
        return "";
    }
    get unit_count() {
        // Unit 0 is common to all units, so it doesn't count towards
        // the total number of units.
        let count = this.units.size;
        if (this.units.has(0)) {
            count -= 1;
        }
        return count;
    }
    get unit() {
        // KiCAD encodes the symbol unit into the name, for example,
        // MCP6001_1_1 is unit 1 and MCP6001_2_1 is unit 2.
        // Unit 0 is common to all units.
        // See SCH_SEXPR_PARSER::ParseSymbol.
        const parts = this.name.split("_");
        if (parts.length < 3) {
            return 0;
        }
        return parseInt(parts.at(-2), 10);
    }
    get style() {
        // KiCAD "De Morgan" body styles are indicated with a number greater
        // than one at the end of the symbol name.
        // MCP6001_1_1 is the normal body and and MCP6001_1_2 is the alt style.
        // Style 0 is common to all styles.
        // See SCH_SEXPR_PARSER::ParseSymbol.
        const parts = this.name.split("_");
        if (parts.length < 3) {
            return 0;
        }
        return parseInt(parts.at(-1), 10);
    }
    get description() {
        return this.properties.get("ki_description")?.text ?? "";
    }
    get keywords() {
        return this.properties.get("ki_keywords")?.text ?? "";
    }
    get footprint_filters() {
        return this.properties.get("ki_fp_filters")?.text ?? "";
    }
    get units_interchangable() {
        return this.properties.get("ki_locked")?.text ? false : true;
    }
    resolve_text_var(name) {
        return this.parent?.resolve_text_var(name);
    }
}
export class Property {
    #effects;
    constructor(expr, parent) {
        this.parent = parent;
        this.show_name = false;
        this.do_not_autoplace = false;
        const parsed = parse_expr(expr, P.start("property"), P.positional("name", T.string), P.positional("text", T.string), P.pair("id", T.number), P.item("at", At), P.item("effects", Effects), P.atom("show_name"), P.atom("do_not_autoplace"));
        this.#effects = parsed["effects"];
        delete parsed["effects"];
        Object.assign(this, parsed);
    }
    get effects() {
        if (this.#effects) {
            return this.#effects;
        }
        else if (this.parent instanceof SchematicSymbol) {
            this.#effects = new Effects();
        }
        else {
            log.warn(`Couldn't determine Effects for Property ${this.name}`);
        }
        return this.#effects;
    }
    set effects(e) {
        this.#effects = e;
    }
    get shown_text() {
        return expand_text_vars(this.text, this.parent);
    }
}
export class PinDefinition {
    constructor(expr, parent) {
        this.parent = parent;
        this.hide = false;
        this.name = {
            text: "",
            effects: new Effects(),
        };
        this.number = {
            text: "",
            effects: new Effects(),
        };
        /*
        (pin power_in line (at -15.24 50.8 270) (length 2.54) hide
          (name "IOVDD" (effects (font (size 1.27 1.27))))
          (number "1" (effects (font (size 1.27 1.27))))
          (alternate "alt" input inverted_clock))
        */
        Object.assign(this, parse_expr(expr, P.start("pin"), P.positional("type", T.string), P.positional("shape", T.string), P.atom("hide"), P.item("at", At), P.pair("length", T.number), P.object("name", this.name, P.positional("text", T.string), P.item("effects", Effects)), P.object("number", this.number, P.positional("text", T.string), P.item("effects", Effects)), P.collection("alternates", "alternate", T.item(PinAlternate))));
    }
    get unit() {
        return this.parent.unit;
    }
}
export class PinAlternate {
    constructor(expr) {
        Object.assign(this, parse_expr(expr, P.start("alternate"), P.positional("name"), P.positional("type", T.string), P.positional("shaped", T.string)));
    }
}
export class SchematicSymbol {
    constructor(expr, parent) {
        this.parent = parent;
        this.in_bom = false;
        this.on_board = false;
        this.dnp = false;
        this.fields_autoplaced = false;
        this.properties = new Map();
        this.pins = [];
        this.instances = new Map();
        /*
        (symbol (lib_id "Device:C_Small") (at 134.62 185.42 0) (unit 1)
          (in_bom yes) (on_board yes) (fields_autoplaced)
          (uuid 42d20c56-7e92-459e-8ba3-25545a76a4e9)
          (property "Reference" "C311" (id 0) (at 137.16 182.8862 0)
            (effects (font (size 1.27 1.27)) (justify left)))
          (property "Value" "100n" (id 1) (at 137.16 185.4262 0)
            (effects (font (size 1.27 1.27)) (justify left)))
          (property "Footprint" "winterbloom:C_0402_HandSolder" (id 2) (at 134.62 185.42 0)
            (effects (font (size 1.27 1.27)) hide))
          (pin "1" (uuid ab9b91d4-020f-476d-acd8-920c7892e89a))
          (pin "2" (uuid ec1eed11-c9f6-4ab0-ad9c-a96c0cb10d03)))
        */
        const parsed = parse_expr(expr, P.start("symbol"), P.pair("lib_name", T.string), P.pair("lib_id", T.string), P.item("at", At), P.pair("mirror", T.string), P.pair("unit", T.number), P.pair("convert", T.number), P.pair("in_bom", T.boolean), P.pair("on_board", T.boolean), P.pair("dnp", T.boolean), P.atom("fields_autoplaced"), P.pair("uuid", T.string), P.mapped_collection("properties", "property", (p) => p.name, T.item(Property, this)), P.collection("pins", "pin", T.item(PinInstance, this)), P.object("default_instance", this.default_instance, P.pair("reference", T.string), P.pair("unit", T.string), P.pair("value", T.string), P.pair("footprint", T.string)), 
        // (instances
        //    (project "kit-dev-coldfire-xilinx_5213"
        //      (path "/f5d7a48d-4587-4550-a504-c505ca11d375" (reference "R111") (unit 1))))
        P.object("instances", {}, P.collection("projects", "project", T.object(null, P.start("project"), P.positional("name", T.string), P.collection("paths", "path", T.object(null, P.start("path"), P.positional("path"), P.pair("reference", T.string), P.pair("value", T.string), P.pair("unit", T.number), P.pair("footprint", T.string)))))));
        const parsed_instances = parsed["instances"];
        delete parsed["instances"];
        Object.assign(this, parsed);
        // Walk through all instances and flatten them.
        for (const project of parsed_instances?.["projects"] ?? []) {
            for (const path of project?.["paths"] ?? []) {
                const inst = new SchematicSymbolInstance();
                inst.path = path["path"];
                inst.reference = path["reference"];
                inst.value = path["value"];
                inst.unit = path["unit"];
                inst.footprint = path["footprint"];
                this.instances.set(inst.path, inst);
            }
        }
        // Default instance is used only to set the value and footprint, the
        // other items seem to be ignored.
        if (this.get_property_text("Value") == undefined) {
            this.set_property_text("Value", this.default_instance.value);
        }
        if (!this.get_property_text("Footprint") == undefined) {
            this.set_property_text("Footprint", this.default_instance.footprint);
        }
    }
    get lib_symbol() {
        // note: skipping a lot of null checks here because unless something
        // horrible has happened, the schematic should absolutely have the
        // library symbol for this symbol instance.
        return this.parent.lib_symbols.by_name(this.lib_name ?? this.lib_id);
    }
    get_property_text(name) {
        return this.properties.get(name)?.text;
    }
    set_property_text(name, val) {
        const prop = this.properties.get(name);
        if (prop) {
            prop.text = val;
        }
    }
    get reference() {
        return this.get_property_text("Reference") ?? "?";
    }
    set reference(val) {
        this.set_property_text("Reference", val);
    }
    get value() {
        return this.get_property_text("Value") ?? "";
    }
    set value(val) {
        this.set_property_text("Value", val);
    }
    get footprint() {
        return this.get_property_text("Footprint") ?? "";
    }
    set footprint(val) {
        this.set_property_text("Footprint", val);
    }
    get unit_suffix() {
        if (!this.unit || this.lib_symbol.unit_count <= 1) {
            return "";
        }
        const A = "A".charCodeAt(0);
        let unit = this.unit;
        let suffix = "";
        do {
            const x = (unit - 1) % 26;
            suffix = String.fromCharCode(A + x) + suffix;
            unit = Math.trunc((unit - x) / 26);
        } while (unit > 0);
        return suffix;
    }
    get unit_pins() {
        return this.pins.filter((pin) => {
            if (this.unit && pin.unit && this.unit != pin.unit) {
                return false;
            }
            return true;
        });
    }
    resolve_text_var(name) {
        if (this.properties.has(name)) {
            return this.properties.get(name)?.shown_text;
        }
        switch (name) {
            case "REFERENCE":
                return this.reference;
            case "VALUE":
                return this.value;
            case "FOOTPRINT":
                return this.footprint;
            case "DATASHEET":
                return this.properties.get("Datasheet")?.name;
            case "FOOTPRINT_LIBRARY":
                return this.footprint.split(":").at(0);
            case "FOOTPRINT_NAME":
                return this.footprint.split(":").at(-1);
            case "UNIT":
                return this.unit_suffix;
            case "SYMBOL_LIBRARY":
                return this.lib_symbol.library_name;
            case "SYMBOL_NAME":
                return this.lib_symbol.library_item_name;
            case "SYMBOL_DESCRIPTION":
                return this.lib_symbol.description;
            case "SYMBOL_KEYWORDS":
                return this.lib_symbol.keywords;
            case "EXCLUDE_FROM_BOM":
                return this.in_bom ? "" : "Excluded from BOM";
            case "EXCLUDE_FROM_BOARD":
                return this.on_board ? "" : "Excluded from board";
            case "DNP":
                return this.dnp ? "DNP" : "";
        }
        return this.parent.resolve_text_var(name);
    }
}
export class SchematicSymbolInstance {
    constructor() { }
}
export class PinInstance {
    constructor(expr, parent) {
        this.parent = parent;
        /* (pin "1" (uuid ab9b91d4-020f-476d-acd8-920c7892e89a) (alternate abc)) */
        Object.assign(this, parse_expr(expr, P.start("pin"), P.positional("number", T.string), P.pair("uuid", T.string), P.pair("alternate", T.string)));
    }
    get definition() {
        return this.parent.lib_symbol.pin_by_number(this.number, this.parent.convert);
    }
    get unit() {
        return this.definition.unit;
    }
}
export class SheetInstances {
    constructor(expr) {
        this.sheet_instances = new Map();
        Object.assign(this, parse_expr(expr, P.start("sheet_instances"), P.mapped_collection("sheet_instances", "path", (obj) => obj.path, T.item(SheetInstance))));
    }
    get(key) {
        return this.sheet_instances.get(key);
    }
}
export class SheetInstance {
    constructor(expr) {
        /* (path "/" (page "1")) */
        Object.assign(this, parse_expr(expr, 
        // note: start is "path"
        P.start("path"), P.positional("path", T.string), P.pair("page", T.string)));
    }
}
export class SymbolInstances {
    constructor(expr) {
        this.symbol_instances = new Map();
        Object.assign(this, parse_expr(expr, P.start("symbol_instances"), P.mapped_collection("symbol_instances", "path", (obj) => obj.path, T.item(SymbolInstance))));
    }
    get(key) {
        return this.symbol_instances.get(key);
    }
}
export class SymbolInstance {
    constructor(expr) {
        /* (path "/dfac8bd5-de3e-410c-a76e-956b6a012495"
            (reference "C?") (unit 1) (value "C_Polarized_US") (footprint "")) */
        Object.assign(this, parse_expr(expr, 
        // note: start is "path"
        P.start("path"), P.positional("path", T.string), P.pair("reference", T.string), P.pair("unit", T.number), P.pair("value", T.string), P.pair("footprint", T.string)));
    }
}
export class SchematicSheet {
    constructor(expr, parent) {
        this.parent = parent;
        this.properties = new Map();
        this.pins = [];
        this.instances = new Map();
        const parsed = parse_expr(expr, P.start("sheet"), P.item("at", At), P.vec2("size"), P.item("stroke", Stroke), P.item("fill", Fill), P.pair("fields_autoplaced", T.boolean), P.pair("uuid", T.string), P.mapped_collection("properties", "property", (prop) => prop.name, T.item(Property, this)), P.collection("pins", "pin", T.item(SchematicSheetPin, this)), 
        // (instances
        //   (project "kit-dev-coldfire-xilinx_5213"
        //     (path "/f5d7a48d-4587-4550-a504-c505ca11d375" (page "3"))))
        P.object("instances", {}, P.collection("projects", "project", T.object(null, P.start("project"), P.positional("name", T.string), P.collection("paths", "path", T.object(null, P.start("path"), P.positional("path"), P.pair("page", T.string)))))));
        const parsed_instances = parsed["instances"];
        delete parsed["instances"];
        Object.assign(this, parsed);
        // Walk through all instances and flatten them.
        for (const project of parsed_instances?.["projects"] ?? []) {
            for (const path of project?.["paths"] ?? []) {
                const inst = new SchematicSheetInstance();
                inst.path = path["path"];
                inst.page = path["page"];
                this.instances.set(inst.path, inst);
            }
        }
    }
    get_property_text(name) {
        return this.properties.get(name)?.text;
    }
    get sheetname() {
        return (this.get_property_text("Sheetname") ??
            this.get_property_text("Sheet name"));
    }
    get sheetfile() {
        return (this.get_property_text("Sheetfile") ??
            this.get_property_text("Sheet file"));
    }
    resolve_text_var(name) {
        return this.parent?.resolve_text_var(name);
    }
}
export class SchematicSheetPin {
    constructor(expr, parent) {
        this.parent = parent;
        Object.assign(this, parse_expr(expr, P.start("pin"), P.positional("name", T.string), P.positional("shape", T.string), P.item("at", At), P.item("effects", Effects), P.pair("uuid", T.string)));
    }
}
export class SchematicSheetInstance {
}
