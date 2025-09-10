import { KCUIElement } from "./element";
/**
 * kc-ui-menu and kc-ui-menu-item encompass a simple menu with selectable items.
 */
export declare class KCUIMenuElement extends KCUIElement {
    static styles: any[];
    constructor();
    items(): any;
    item_by_name(name: string): KCUIMenuItemElement | null;
    deselect(): void;
    get selected(): KCUIMenuItemElement | null;
    set selected(element_or_name: KCUIMenuItemElement | string | null);
    private send_selected_event;
    initialContentCallback(): void;
    render(): any;
}
export declare class KCUIMenuItemElement extends KCUIElement {
    static styles: any[];
    constructor();
    name: string;
    icon: string;
    selected: boolean;
    disabled: boolean;
    render(): any;
}
export declare class KCUIMenuLabelElement extends KCUIElement {
    static styles: any[];
    render(): any;
}
