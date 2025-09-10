import { KCUIElement } from "./element";
export declare class KCUITextFilterInputElement extends KCUIElement {
    static styles: any[];
    private input;
    get value(): string;
    set value(v: string);
    private button;
    initialContentCallback(): void | undefined;
    render(): any;
}
