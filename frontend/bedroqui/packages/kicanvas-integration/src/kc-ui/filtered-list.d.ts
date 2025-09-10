import { KCUIElement } from "./element";
export declare class KCUIFilteredListElement extends KCUIElement {
    #private;
    static styles: any[];
    render(): Element | DocumentFragment;
    set filter_text(v: string | null);
    get filter_text(): string | null;
    private get item_selector();
    private items;
    private apply_filter;
}
