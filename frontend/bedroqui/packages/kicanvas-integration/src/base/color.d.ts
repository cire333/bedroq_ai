export declare class Color {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r: number, g: number, b: number, a?: number);
    copy(): Color;
    static get transparent_black(): Color;
    static get black(): Color;
    static get white(): Color;
    static from_css(str: string): Color;
    to_css(): string;
    to_array(): [number, number, number, number];
    get r_255(): number;
    set r_255(v: number);
    get g_255(): number;
    set g_255(v: number);
    get b_255(): number;
    set b_255(v: number);
    get is_transparent_black(): boolean;
    with_alpha(a: number): Color;
    desaturate(): Color;
    mix(other: Color, amount: number): Color;
}
/**
 * Convert normalized RGB to HSL
 */
export declare function rgb_to_hsl(r: number, g: number, b: number): [number, number, number];
/**
 * Convert normalized HSL to RGB
 */
export declare function hsl_to_rgb(h: number, s: number, l: number): [number, number, number];
