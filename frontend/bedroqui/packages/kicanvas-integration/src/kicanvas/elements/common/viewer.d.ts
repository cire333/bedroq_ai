import type { Viewer } from "../../../viewers/base/viewer";
import { Preferences } from "../../preferences";
import type { ProjectPage } from "../../project";
declare const KCViewerElement_base: any;
/**
 * Basic element for wiring up a Viewer to the DOM.
 */
export declare abstract class KCViewerElement<ViewerT extends Viewer> extends KCViewerElement_base {
    canvas: HTMLCanvasElement;
    viewer: ViewerT;
    selected: any[];
    loaded: boolean;
    theme: string;
    disableinteraction: boolean;
    initialContentCallback(): void;
    preferenceChangeCallback(preferences: Preferences): Promise<void>;
    disconnectedCallback(): void;
    protected get themeObject(): any;
    protected abstract update_theme(): void;
    protected abstract make_viewer(): ViewerT;
    load(src: ProjectPage): Promise<void>;
    render(): any;
}
export {};
