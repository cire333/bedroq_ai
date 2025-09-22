import { KCUIElement } from "../../../kc-ui";
import type { Viewer } from "../../../viewers/base/viewer";
export declare class KCViewerBottomToolbarElement extends KCUIElement {
    #private;
    static styles: any[];
    viewer: Viewer;
    connectedCallback(): void;
    private update_position;
    render(): any;
}
