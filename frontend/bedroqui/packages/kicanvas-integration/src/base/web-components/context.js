/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
/**
 * Context request event
 *
 * Dispatch this event to request context from ancestors. Ancestors can listen
 * for the event and invoke the provided callback to provide context. Invoking
 * the callback will automatically stop the event's propagation.
 */
export class ContextRequestEvent extends Event {
    static { this.type = "context-request"; }
    constructor(context_name, _callback) {
        super(ContextRequestEvent.type, {
            bubbles: true,
            cancelable: true,
            composed: true,
        });
        this.context_name = context_name;
        this._callback = _callback;
    }
    callback(context) {
        this.stopPropagation();
        this._callback(context);
    }
}
/**
 * Requests context from ancestors asynchronously.
 *
 * Handles the details of dispatching the ContextRequestEvent and wraps it
 * all up in a promise. Note that if no ancestor provides the context, the
 * promise will never resolve.
 */
export async function requestContext(target, context_name) {
    return new Promise((resolve) => {
        target.dispatchEvent(new ContextRequestEvent(context_name, (context) => {
            resolve(context);
        }));
    });
}
/**
 * Provides context to descendants.
 *
 * Handles the details of listening to ContextRequestEvents and responding
 * with the given context if it matches the context name.
 */
export function provideContext(target, context_name, context) {
    target.addEventListener(ContextRequestEvent.type, (e) => {
        const request_event = e;
        if (request_event.context_name == context_name) {
            request_event.callback(context);
        }
    });
}
/**
 * Like requestContext but used when the provider passes a function that
 * should be called to obtain the context. Useful for setting up context
 * providers in constructors before the actual context value is available.
 */
export async function requestLazyContext(target, context_name) {
    return (await requestContext(target, context_name))();
}
/**
 * Like provideContext but used with requestLazyContext
 */
export async function provideLazyContext(target, context_name, context) {
    provideContext(target, context_name, context);
}
/**
 * Mixin used to add provideContext and requestContext methods.
 */
export function WithContext(Base) {
    return class WithContext extends Base {
        constructor(...args) {
            super(...args);
        }
        /** Request context from ancestors */
        async requestContext(context_name) {
            return await requestContext(this, context_name);
        }
        /** Provide context to descendants */
        provideContext(context_name, context) {
            provideContext(this, context_name, context);
        }
        /** Request context from ancestors lazily */
        async requestLazyContext(context_name) {
            return await requestLazyContext(this, context_name);
        }
        /** Provide context to descendants lazily */
        provideLazyContext(context_name, context) {
            provideLazyContext(this, context_name, context);
        }
    };
}
