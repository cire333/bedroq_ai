import { KCUIElement } from "./element";
/**
 * kc-ui-focus-overlay is an element that shows an overlay over its siblings
 * until the user clicks within.
 */
export declare class KCUIFocusOverlay extends KCUIElement {
    #private;
    static styles: any[];
    initialContentCallback(): void | undefined;
    render(): any;
}
