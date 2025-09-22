declare class KiCanvasEvent<T> extends CustomEvent<T> {
    constructor(name: string, detail: T, bubbles?: boolean);
}
export declare class KiCanvasLoadEvent extends KiCanvasEvent<null> {
    static readonly type = "kicanvas:load";
    constructor();
}
interface SelectDetails {
    item: unknown;
    previous: unknown;
}
export declare class KiCanvasSelectEvent extends KiCanvasEvent<SelectDetails> {
    static readonly type = "kicanvas:select";
    constructor(detail: SelectDetails);
}
interface MouseMoveDetails {
    x: number;
    y: number;
}
export declare class KiCanvasMouseMoveEvent extends KiCanvasEvent<MouseMoveDetails> {
    static readonly type = "kicanvas:mousemove";
    constructor(detail: MouseMoveDetails);
}
export interface KiCanvasEventMap {
    [KiCanvasLoadEvent.type]: KiCanvasLoadEvent;
    [KiCanvasSelectEvent.type]: KiCanvasSelectEvent;
    [KiCanvasMouseMoveEvent.type]: KiCanvasMouseMoveEvent;
}
declare global {
    interface WindowEventMap {
        [KiCanvasLoadEvent.type]: KiCanvasLoadEvent;
        [KiCanvasSelectEvent.type]: KiCanvasSelectEvent;
    }
    interface HTMLElementEventMap {
        [KiCanvasLoadEvent.type]: KiCanvasLoadEvent;
        [KiCanvasSelectEvent.type]: KiCanvasSelectEvent;
    }
}
export {};
