import { KCUIElement } from "./element";
/**
 * A toggle menu combines a button and a dropdown into a single element.
 *
 * This element holds a button and a kc-ui-dropdown, the button is used to
 * toggle the dropdown.
 */
export declare class KCUIToggleMenuElement extends KCUIElement {
    static styles: any[];
    icon: string;
    visible: boolean;
    get dropdown(): any;
    get button(): any;
    initialContentCallback(): void;
    render(): any;
}
