import { KCUIElement } from "./element";
/**
 * kc-ui-activity-bar is a vscode-style side bar with an action bar with icons
 * and a panel with various activities.
 */
export declare class KCUIActivitySideBarElement extends KCUIElement {
    #private;
    static styles: any[];
    private activities_container;
    private buttons;
    collapsed: boolean;
    render(): any;
    initialContentCallback(): void;
    static get observedAttributes(): string[];
    attributeChangedCallback(name: string, old: string | null, value: string | null | undefined): void;
    get activity(): string | null | undefined;
    set activity(name: string | null | undefined);
    hide_activities(): void;
    show_activities(): void;
    change_activity(name: string | null | undefined, toggle?: boolean): void;
    private update_state;
}
