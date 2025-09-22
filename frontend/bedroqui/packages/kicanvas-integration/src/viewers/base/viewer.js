/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Barrier, later } from "../../base/async";
import { Disposables } from "../../base/disposable";
import { listen } from "../../base/events";
import { no_self_recursion } from "../../base/functions";
import { Vec2 } from "../../base/math";
import { Color, Polygon, Polyline } from "../../graphics";
import { KiCanvasLoadEvent, KiCanvasMouseMoveEvent, KiCanvasSelectEvent, } from "./events";
import { Viewport } from "./viewport";
export class Viewer extends EventTarget {
    #selected;
    constructor(canvas, interactive = true) {
        super();
        this.canvas = canvas;
        this.interactive = interactive;
        this.mouse_position = new Vec2(0, 0);
        this.loaded = new Barrier();
        this.disposables = new Disposables();
        this.setup_finished = new Barrier();
    }
    dispose() {
        this.disposables.dispose();
    }
    addEventListener(type, listener, options) {
        super.addEventListener(type, listener, options);
        return {
            dispose: () => {
                this.removeEventListener(type, listener, options);
            },
        };
    }
    async setup() {
        this.renderer = this.disposables.add(this.create_renderer(this.canvas));
        await this.renderer.setup();
        this.viewport = this.disposables.add(new Viewport(this.renderer, () => {
            this.on_viewport_change();
        }));
        if (this.interactive) {
            this.viewport.enable_pan_and_zoom(0.5, 190);
            this.disposables.add(listen(this.canvas, "mousemove", (e) => {
                this.on_mouse_change(e);
            }));
            this.disposables.add(listen(this.canvas, "panzoom", (e) => {
                this.on_mouse_change(e);
            }));
            this.disposables.add(listen(this.canvas, "click", (e) => {
                const items = this.layers.query_point(this.mouse_position);
                this.on_pick(this.mouse_position, items);
            }));
        }
        this.setup_finished.open();
    }
    on_viewport_change() {
        if (this.interactive) {
            this.draw();
        }
    }
    on_mouse_change(e) {
        const rect = this.canvas.getBoundingClientRect();
        const new_position = this.viewport.camera.screen_to_world(new Vec2(e.clientX - rect.left, e.clientY - rect.top));
        if (this.mouse_position.x != new_position.x ||
            this.mouse_position.y != new_position.y) {
            this.mouse_position.set(new_position);
            this.dispatchEvent(new KiCanvasMouseMoveEvent(this.mouse_position));
        }
    }
    resolve_loaded(value) {
        if (value) {
            this.loaded.open();
            this.dispatchEvent(new KiCanvasLoadEvent());
        }
    }
    on_draw() {
        this.renderer.clear_canvas();
        if (!this.layers) {
            return;
        }
        // Render all layers in display order (back to front)
        let depth = 0.01;
        const camera = this.viewport.camera.matrix;
        const should_dim = this.layers.is_any_layer_highlighted();
        for (const layer of this.layers.in_display_order()) {
            if (layer.visible && layer.graphics) {
                let alpha = layer.opacity;
                if (should_dim && !layer.highlighted) {
                    alpha = 0.25;
                }
                layer.graphics.render(camera, depth, alpha);
                depth += 0.01;
            }
        }
    }
    draw() {
        if (!this.viewport) {
            return;
        }
        window.requestAnimationFrame(() => {
            this.on_draw();
        });
    }
    on_pick(mouse, items) {
        let selected = null;
        for (const { bbox } of items) {
            selected = bbox;
            break;
        }
        this.select(selected);
    }
    select(item) {
        this.selected = item;
    }
    get selected() {
        return this.#selected;
    }
    set selected(bb) {
        this._set_selected(bb);
    }
    _set_selected(bb) {
        const previous = this.#selected;
        this.#selected = bb?.copy() || null;
        // Notify event listeners
        this.dispatchEvent(new KiCanvasSelectEvent({
            item: this.#selected?.context,
            previous: previous?.context,
        }));
        later(() => this.paint_selected());
    }
    get selection_color() {
        return Color.white;
    }
    paint_selected() {
        const layer = this.layers.overlay;
        layer.clear();
        if (this.#selected) {
            const bb = this.#selected.copy().grow(this.#selected.w * 0.1);
            this.renderer.start_layer(layer.name);
            this.renderer.line(Polyline.from_BBox(bb, 0.254, this.selection_color));
            this.renderer.polygon(Polygon.from_BBox(bb, this.selection_color));
            layer.graphics = this.renderer.end_layer();
            layer.graphics.composite_operation = "overlay";
        }
        this.draw();
    }
    zoom_to_selection() {
        if (!this.selected) {
            return;
        }
        this.viewport.camera.bbox = this.selected.grow(10);
        this.draw();
    }
}
__decorate([
    no_self_recursion
], Viewer.prototype, "_set_selected", null);
