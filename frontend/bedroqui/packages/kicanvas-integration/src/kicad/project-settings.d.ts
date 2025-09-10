/**
 * Holds configuration and settings from a .kicad_pro file.
 *
 * See KiCAD's PROJECT_FILE class
 */
export declare class ProjectSettings {
    board: BoardSettings;
    boards: [string, string][];
    cvpcb?: unknown;
    erc?: unknown;
    libraries: {
        pinned_footprint_libs: string[];
        pinned_symbol_libs: string[];
    };
    meta: {
        filename: string;
        version: number;
    };
    net_settings: unknown;
    pcbnew: {
        page_layout_descr_file: string;
    };
    schematic: SchematicSettings;
    sheets: [string, string][];
    text_variables?: Record<string, string>;
    [s: string]: unknown;
    static load(src: any): ProjectSettings;
}
export declare class BoardSettings {
    design_settings: BoardDesignSettings;
    layer_presets?: unknown;
    viewports?: unknown;
    [s: string]: unknown;
}
export declare class BoardDesignSettings {
    defaults: BoardDesignSettingsDefaults;
    [s: string]: unknown;
}
export declare class BoardDesignSettingsDefaults {
    board_outline_line_width: number;
    copper_line_width: number;
    copper_text_size_h: number;
    copper_text_size_v: number;
    copper_text_thickness: number;
    other_line_width: number;
    silk_line_width: number;
    silk_text_size_h: number;
    silk_text_size_v: number;
    silk_text_thickness: number;
    [s: string]: unknown;
}
export declare class SchematicSettings {
    drawing: SchematicDrawingSettings;
    meta: {
        version: number;
    };
    [s: string]: unknown;
}
export declare class SchematicDrawingSettings {
    dashed_lines_dash_length_ratio: number;
    dashed_lines_gap_length_ratio: number;
    default_line_thickness: number;
    default_text_size: number;
    field_names: unknown[];
    intersheets_ref_own_page: boolean;
    intersheets_ref_prefix: string;
    intersheets_ref_short: boolean;
    intersheets_ref_show: boolean;
    intersheets_ref_suffix: string;
    junction_size_choice: number;
    label_size_ratio: number;
    pin_symbol_size: number;
    text_offset_ratio: number;
    [s: string]: unknown;
}
