import type { Constructor } from "../base/types";
import type { KCUIElement } from "../kc-ui";
import type { Theme } from "../kicad";
export declare class Preferences extends EventTarget {
    static readonly INSTANCE: Preferences;
    private storage;
    theme: Theme;
    alignControlsWithKiCad: boolean;
    save(): void;
    load(): void;
}
export type PreferencesChangeEventDetails = {
    preferences: Preferences;
};
export declare class PreferencesChangeEvent extends CustomEvent<PreferencesChangeEventDetails> {
    static readonly type = "kicanvas:preferences:change";
    constructor(detail: PreferencesChangeEventDetails);
}
/**
 * Mixin used to add provideContext and requestContext methods.
 */
export declare function WithPreferences<T extends Constructor<KCUIElement>>(Base: T): {
    new (...args: any[]): {
        readonly preferences: Preferences;
        preferenceChangeCallback(preferences: Preferences): Promise<void>;
    };
} & T;
