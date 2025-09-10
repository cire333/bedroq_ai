import { KCUIElement } from "./element";
/**
 * kc-ui-range is a wrapper around <input type="range">
 */
export declare class KCUIRangeElement extends KCUIElement {
    static styles: any[];
    name: string;
    min: string;
    max: string;
    step: string;
    disabled: boolean;
    static get observedAttributes(): string[];
    get value(): string;
    set value(val: string);
    get valueAsNumber(): number;
    private input;
    attributeChangedCallback(name: string, old: string | null, value: string | null): void;
    initialContentCallback(): void;
    render(): any;
}
