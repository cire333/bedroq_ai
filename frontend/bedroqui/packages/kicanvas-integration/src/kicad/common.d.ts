import { Color } from "../base/color";
import { Vec2 } from "../base/math";
import { type Parseable } from "./parser";
export declare function unescape_string(str: string): string;
export type HasResolveTextVars = {
    resolve_text_var: (name: string) => string | undefined;
};
export declare function expand_text_vars(text: string, resolveable: HasResolveTextVars | undefined): string;
export declare class At {
    position: any;
    rotation: number;
    unlocked: boolean;
    constructor(expr?: Parseable);
    copy(): At;
}
export declare const PaperSize: {
    User: readonly [431.8, 279.4];
    A0: readonly [1189, 841];
    A1: readonly [841, 594];
    A2: readonly [594, 420];
    A3: readonly [420, 297];
    A4: readonly [297, 210];
    A5: readonly [210, 148];
    A: readonly [279.4, 215.9];
    B: readonly [431.8, 279.4];
    C: readonly [558.8, 431.8];
    D: readonly [863.6, 558.8];
    E: readonly [1117.6, 863.6];
    USLetter: readonly [279.4, 215.9];
    USLegal: readonly [355.6, 215.9];
    USLedger: readonly [431.8, 279.4];
};
export type PaperSizeName = keyof typeof PaperSize;
export declare class Paper {
    size: PaperSizeName;
    width?: number;
    height?: number;
    portrait: boolean;
    constructor(expr: Parseable);
}
export declare class TitleBlock {
    title: string;
    date: string;
    rev: string;
    company: string;
    comment: Record<string, string>;
    constructor(expr?: Parseable);
    resolve_text_var(name: string): string | undefined;
}
export declare class Effects {
    font: Font;
    justify: Justify;
    hide: boolean;
    constructor(expr?: Parseable);
    copy(): Effects;
}
export declare class Font {
    face?: string;
    size: Vec2;
    thickness: number;
    bold: boolean;
    italic: boolean;
    color: Color;
    constructor(expr?: Parseable);
    copy(): Font;
}
export declare class Justify {
    horizontal: "left" | "center" | "right";
    vertical: "top" | "center" | "bottom";
    mirror: boolean;
    constructor(expr?: Parseable);
    copy(): Justify;
}
export declare class Stroke {
    width: number;
    type: "dash" | "dot" | "dash_dot" | "dash_dot_dot" | "solid" | "default";
    color: Color;
    constructor(expr: Parseable);
}
