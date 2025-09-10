import type { IDisposable } from "./disposable";
/**
 * Adds an event listener and wraps it as a Disposable. When disposed, the
 * event listener is removed from the target.
 */
export declare function listen<K extends keyof GlobalEventHandlersEventMap>(target: EventTarget, type: K, handler: (event: GlobalEventHandlersEventMap[K]) => void, use_capture_or_options?: boolean | AddEventListenerOptions): IDisposable;
export declare function listen(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject | null, use_capture_or_options?: boolean | AddEventListenerOptions): IDisposable;
/**
 * Adds a delegated event listener, which listens for events on `parent` that
 * occur from or within children matching `match`.
 */
export declare function delegate<K extends keyof GlobalEventHandlersEventMap>(target: EventTarget, match: string, type: K, handler: (event: GlobalEventHandlersEventMap[K], source: HTMLElement) => void, use_capture_or_options?: boolean | AddEventListenerOptions): IDisposable;
export declare function delegate(parent: EventTarget, match: string, type: string, handler: (evt: Event, source: HTMLElement) => void, use_capture_or_options?: boolean | AddEventListenerOptions): IDisposable;
