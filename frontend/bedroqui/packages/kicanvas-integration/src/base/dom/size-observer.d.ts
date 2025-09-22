import type { IDisposable } from "../disposable";
type ResizeObserverCallback = (target: HTMLElement) => void;
/**
 * Wrapper over ResizeObserver that implmenets IDisposable
 */
export declare class SizeObserver implements IDisposable {
    #private;
    target: HTMLElement;
    private callback;
    constructor(target: HTMLElement, callback: ResizeObserverCallback);
    dispose(): void;
}
export {};
