export declare class CSS {
    readonly css_string: string;
    constructor(css_string: string);
    get stylesheet(): CSSStyleSheet;
}
export declare function css(strings: TemplateStringsArray, ...values: (CSS | number)[]): CSS;
export declare function adopt_styles(root: ShadowRoot | Document, styles: (CSS | CSSStyleSheet)[]): void;
