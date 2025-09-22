import { DeferredPromise } from "../../../base/async";
import { type ElementOrFragment } from "../../../base/web-components";
import { KCUIElement } from "../../../kc-ui";
import type { Viewer } from "../../../viewers/base/viewer";
import type { Project, ProjectPage } from "../../project";
import "./help-panel";
import "./preferences-panel";
import "./project-panel";
import "./viewer-bottom-toolbar";
interface ViewerElement extends HTMLElement {
    viewer: Viewer;
    load(src: ProjectPage): Promise<void>;
    disableinteraction: boolean;
}
/**
 * Common base class for the schematic, board, etc. apps.
 */
export declare abstract class KCViewerAppElement<ViewerElementT extends ViewerElement> extends KCUIElement {
    #private;
    project: Project;
    viewerReady: DeferredPromise<boolean>;
    constructor();
    get viewer(): Viewer;
    controls: "none" | "basic" | "full";
    controlslist: string;
    sidebarcollapsed: boolean;
    connectedCallback(): void;
    initialContentCallback(): void;
    protected abstract on_viewer_select(item?: unknown, previous?: unknown): void;
    protected abstract can_load(src: ProjectPage): boolean;
    load(src: ProjectPage): Promise<void>;
    protected make_pre_activities(): any[];
    protected make_post_activities(): any[];
    protected abstract make_activities(): ElementOrFragment[];
    protected change_activity(name?: string): void;
    protected abstract make_viewer_element(): ViewerElementT;
    render(): any;
    renderedCallback(): void | undefined;
}
export {};
