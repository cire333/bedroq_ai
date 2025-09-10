/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { listen } from "../base/events";
import { LocalStorage } from "../base/local-storage";
import themes from "./themes";
export class Preferences extends EventTarget {
    constructor() {
        super(...arguments);
        this.storage = new LocalStorage("kc:prefs");
        this.theme = themes.default;
        this.alignControlsWithKiCad = true;
    }
    static { this.INSTANCE = new Preferences(); }
    save() {
        this.storage.set("theme", this.theme.name);
        this.storage.set("alignControlsWithKiCad", this.alignControlsWithKiCad);
        this.dispatchEvent(new PreferencesChangeEvent({ preferences: this }));
    }
    load() {
        this.theme = themes.by_name(this.storage.get("theme", themes.default.name));
        this.alignControlsWithKiCad = this.storage.get("alignControlsWithKiCad", false);
    }
}
Preferences.INSTANCE.load();
export class PreferencesChangeEvent extends CustomEvent {
    static { this.type = "kicanvas:preferences:change"; }
    constructor(detail) {
        super(PreferencesChangeEvent.type, {
            detail: detail,
            composed: true,
            bubbles: true,
        });
    }
}
/**
 * Mixin used to add provideContext and requestContext methods.
 */
export function WithPreferences(Base) {
    return class WithPreferences extends Base {
        constructor(...args) {
            super(...args);
            this.addDisposable(listen(Preferences.INSTANCE, PreferencesChangeEvent.type, () => {
                this.preferenceChangeCallback(this.preferences);
            }));
        }
        get preferences() {
            return Preferences.INSTANCE;
        }
        async preferenceChangeCallback(preferences) { }
    };
}
