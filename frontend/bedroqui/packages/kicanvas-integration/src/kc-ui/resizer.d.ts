import { KCUIElement } from "./element";
/**
 * kc-ui-resizer allow re-sizing a kc-ui-view with the mouse.
 *
 * Presently it's only able to resize the element to its immediate right.
 */
export declare class KCUIResizerElement extends KCUIElement {
    static styles: any[];
    initialContentCallback(): void;
}
