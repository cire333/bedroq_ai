/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { is_iterable, is_primitive } from "../types";
export function is_HTMLElement(v) {
    return typeof HTMLElement === "object" && v instanceof HTMLElement;
}
/**
 * A tagged template literal that generates HTML
 *
 * This is loosely inspired by Lit's html, but vastly simplified for our use
 * case. We don't do any reactivity or automatic updating, so a lot of the
 * code required to synchronize and update DOM elements automatically isn't
 * needed.
 *
 * There are two key properties that this needs to have:
 * - It must limit the location of variable expansion so we can effectively
 *   work against XSS.
 * - Any elements used in the template literal should retain their identity
 *   once placed in the rendered tree.
 */
export function html(strings, ...values) {
    const template = document.createElement(`template`);
    template.innerHTML = prepare_template_html(strings, values);
    let content = template.content;
    content = document.importNode(content, true);
    apply_values_to_tree(content, values);
    if (content.childElementCount == 1) {
        return content.firstElementChild;
    }
    else {
        return content;
    }
}
/**
 * A tagged template literal that allows text to pass through the html
 * literal as-is, before variable interpolation happens.
 */
export function literal(strings, ...values) {
    let str = "";
    strings.forEach((string, i) => {
        str += string + (values[i] ?? "");
    });
    return new Literal(str);
}
class Literal {
    constructor(text) {
        this.text = text;
    }
}
const placeholder_regex = /\$\$:(\d+):\$\$/g;
/**
 * Processes a given template literal into a suitable html template string.
 *
 * Inserts placeholders into the string for every replacement. These
 * placeholders will later be used to modify the constructed DOM node's
 * attributes and content.
 */
function prepare_template_html(strings, values) {
    const template_parts = [];
    for (let i = 0; i < strings.length - 1; i++) {
        template_parts.push(strings[i]);
        if (values[i] instanceof Literal) {
            template_parts.push(values[i].text);
        }
        else {
            template_parts.push(`$$:${i}:$$`);
        }
    }
    template_parts.push(strings[strings.length - 1]);
    const template_string = template_parts.join("");
    return template_string;
}
/**
 * Walks through the give DOM tree and replaces placeholders with values.
 */
function apply_values_to_tree(tree, values) {
    const walker = document.createTreeWalker(tree, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode()) !== null) {
        if (node.nodeType == Node.TEXT_NODE) {
            apply_content_value(node.parentNode, node, values);
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            const elm = node;
            for (const attr_name of elm.getAttributeNames()) {
                const attr = elm.getAttributeNode(attr_name);
                apply_attribute_value(elm, attr, values);
            }
        }
    }
}
/**
 * Apply template values to a node's text content.
 */
function apply_content_value(node, text, values) {
    if (!node) {
        return;
    }
    const parts = text.data.split(placeholder_regex);
    if (!parts || parts.length == 1) {
        return;
    }
    if (is_HTMLElement(node) && ["script", "style"].includes(node.localName)) {
        throw new Error(`Cannot bind values inside of <script> or <style> tags`);
    }
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // Don't bother adding empty text
        if (!part) {
            continue;
        }
        // Even parts are text nodes.
        if (i % 2 == 0) {
            node.insertBefore(new Text(part), text);
        }
        // Odd parts are placeholders.
        else {
            for (const value of convert_value_for_content(values[parseInt(part, 10)])) {
                if (value == null)
                    continue;
                node.insertBefore(value, text);
            }
        }
    }
    // clear the text data instead of removing the node, since removing it will
    // break the tree walker.
    text.data = "";
}
/**
 * Apply template values to an element's attribute.
 */
function apply_attribute_value(elm, attr, values) {
    const parts = attr.value.split(placeholder_regex);
    if (!parts || parts.length == 1) {
        return;
    }
    if (attr.localName.startsWith("on")) {
        throw new Error(`Cannot bind to event handler ${attr.localName}.`);
    }
    if (parts.length == 3 && parts[0] == "" && parts[2] == "") {
        // special case of attr="${value}", which explicitly handles true/false
        const value = values[parseInt(parts[1], 10)];
        if (value === true) {
            attr.value = "";
        }
        else if (value === false || value === null || value === undefined) {
            elm.removeAttribute(attr.name);
        }
        else {
            attr.value = convert_value_for_attr(value, attr.name);
        }
        return;
    }
    attr.value = attr.value.replaceAll(placeholder_regex, (_, number) => {
        const value = values[parseInt(number, 10)];
        return convert_value_for_attr(value, attr.localName);
    });
}
function* convert_value_for_content(value) {
    if (value == null || value == undefined) {
        return;
    }
    if (is_primitive(value)) {
        yield new Text(value.toString());
        return;
    }
    if (value instanceof Node || value instanceof DocumentFragment) {
        yield value;
        return;
    }
    if (is_iterable(value)) {
        for (const i of value) {
            yield* convert_value_for_content(i);
        }
        return;
    }
    throw new Error(`Invalid value ${value}`);
}
function convert_value_for_attr(value, attr_name) {
    if (value == null || value == undefined) {
        return "";
    }
    if (is_primitive(value)) {
        return value.toString();
    }
    if (is_iterable(value)) {
        return Array.from(value)
            .map((v) => convert_value_for_attr(v, attr_name))
            .join("");
    }
    throw new Error(`Invalid value ${value}`);
}
