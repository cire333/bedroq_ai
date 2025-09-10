/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
class KiCanvasEvent extends CustomEvent {
    constructor(name, detail, bubbles = false) {
        super(name, { detail: detail, composed: true, bubbles: bubbles });
    }
}
export class KiCanvasLoadEvent extends KiCanvasEvent {
    static { this.type = "kicanvas:load"; }
    constructor() {
        super(KiCanvasLoadEvent.type, null);
    }
}
export class KiCanvasSelectEvent extends KiCanvasEvent {
    static { this.type = "kicanvas:select"; }
    constructor(detail) {
        super(KiCanvasSelectEvent.type, detail, true);
    }
}
export class KiCanvasMouseMoveEvent extends KiCanvasEvent {
    static { this.type = "kicanvas:mousemove"; }
    constructor(detail) {
        super(KiCanvasMouseMoveEvent.type, detail, true);
    }
}
