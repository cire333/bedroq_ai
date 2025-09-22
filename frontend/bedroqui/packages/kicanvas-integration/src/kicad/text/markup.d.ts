/**
 * KiCAD text markup parser
 *
 * KiCAD uses basic text markup to express subscript, superscript, and overbar
 * text. For example "normal ^{superscript} _{subscript} ~{overbar}".
 */
export declare class Markup {
    text: string;
    root: MarkupNode;
    constructor(text: string);
}
export declare class MarkupNode {
    is_root: boolean;
    subscript: boolean;
    superscript: boolean;
    overbar: boolean;
    text: string;
    children: MarkupNode[];
}
