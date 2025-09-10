import { KCUIElement } from "./element";
/**
 * kc-ui-button wraps the <button> element with common styles and behaviors
 */
export declare class KCUIButtonElement extends KCUIElement {
    static styles: any[];
    private button;
    private button_icon;
    name: string | null;
    icon: string | null;
    variant: string | null;
    disabled: boolean;
    selected: boolean;
    static get observedAttributes(): string[];
    attributeChangedCallback(name: string, old: string | null, value: string | null): void;
    initialContentCallback(): void;
    render(): any;
}
