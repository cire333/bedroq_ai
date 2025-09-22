/**
 * Common building blocks for KiCanvas's UI.
 *
 * These are basic, fundamental elements used to built KiCanvas's UI. These
 * elements are all named <kc-ui-*>, and must exist within a <kc-ui-app> parent
 *
 */
import { CustomElement } from "../base/web-components";
/**
 * kc-ui-app is the parent container for all kc-ui-* elements.
 */
export declare class KCUIAppElement extends CustomElement {
    static useShadowRoot: boolean;
}
