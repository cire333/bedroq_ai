import { KCUIElement } from "./element";
/**
 * kc-ui-dropdown is a basic dropdown menu.
 *
 * This can be used for dropdown menus or for context menus.
 *
 * It also makes sure not to immediately close the menu when the user mouses
 * out, instead relying on a buffer zone.
 */
export declare class KCUIDropdownElement extends KCUIElement {
    static styles: any[];
    constructor();
    show(): void;
    hide(): void;
    toggle(): void;
    visible: boolean;
    mouseout_padding: number;
    get menu(): any;
    initialContentCallback(): void;
    private setup_leave_event;
    render(): any;
}
