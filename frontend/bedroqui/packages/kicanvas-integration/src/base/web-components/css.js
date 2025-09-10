/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { is_number } from "../types";
const stylesheet_cache = new Map();
export class CSS {
    constructor(css_string) {
        this.css_string = css_string;
    }
    get stylesheet() {
        let sheet = stylesheet_cache.get(this.css_string);
        if (sheet == undefined) {
            sheet = new CSSStyleSheet();
            sheet.replaceSync(this.css_string);
            stylesheet_cache.set(this.css_string, sheet);
        }
        return sheet;
    }
}
export function css(strings, ...values) {
    let text = "";
    for (let i = 0; i < strings.length - 1; i++) {
        text += strings[i];
        const value = values[i];
        if (value instanceof CSS) {
            text += value.css_string;
        }
        else if (is_number(value)) {
            text += String(value);
        }
        else {
            throw new Error("Only CSS or number variables allowed in css template literal");
        }
    }
    text += strings.at(-1);
    return new CSS(text);
}
export function adopt_styles(root, styles) {
    root.adoptedStyleSheets = root.adoptedStyleSheets.concat(styles.map((ss) => (ss instanceof CSSStyleSheet ? ss : ss.stylesheet)));
}
