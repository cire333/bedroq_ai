/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { merge } from "../base/object";
/**
 * Holds configuration and settings from a .kicad_pro file.
 *
 * See KiCAD's PROJECT_FILE class
 */
export class ProjectSettings {
    constructor() {
        this.board = new BoardSettings();
        this.boards = [];
        this.libraries = { pinned_footprint_libs: [], pinned_symbol_libs: [] };
        this.meta = { filename: "unknown.kicad_pro", version: 1 };
        this.pcbnew = { page_layout_descr_file: "" };
        this.schematic = new SchematicSettings();
        this.sheets = [];
        this.text_variables = {};
    }
    static load(src) {
        const project = new ProjectSettings();
        merge(project, src);
        return project;
    }
}
export class BoardSettings {
    constructor() {
        // board_design_settings.cpp
        this.design_settings = new BoardDesignSettings();
    }
}
export class BoardDesignSettings {
    constructor() {
        this.defaults = new BoardDesignSettingsDefaults();
    }
}
export class BoardDesignSettingsDefaults {
    constructor() {
        this.board_outline_line_width = 0.1;
        this.copper_line_width = 0.2;
        this.copper_text_size_h = 1.5;
        this.copper_text_size_v = 1.5;
        this.copper_text_thickness = 0.3;
        this.other_line_width = 0.15;
        this.silk_line_width = 0.15;
        this.silk_text_size_h = 1.0;
        this.silk_text_size_v = 1.0;
        this.silk_text_thickness = 0.15;
    }
}
// SCHEMATIC_SETTINGS schematic_settings.cpp
export class SchematicSettings {
    constructor() {
        this.drawing = new SchematicDrawingSettings();
        this.meta = { version: 1 };
    }
}
// EESCHEMA_SETTINGS
export class SchematicDrawingSettings {
    constructor() {
        this.dashed_lines_dash_length_ratio = 12;
        this.dashed_lines_gap_length_ratio = 3;
        this.default_line_thickness = 6;
        this.default_text_size = 50;
        this.intersheets_ref_own_page = false;
        this.intersheets_ref_prefix = "";
        this.intersheets_ref_short = false;
        this.intersheets_ref_show = false;
        this.intersheets_ref_suffix = "";
        this.junction_size_choice = 3;
        this.label_size_ratio = 0.375;
        this.pin_symbol_size = 25.0;
        this.text_offset_ratio = 0.15;
    }
}
