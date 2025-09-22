import { Barrier } from "../base/async";
import { type IDisposable } from "../base/disposable";
import { ProjectSettings } from "../kicad";
import type { VirtualFileSystem } from "./services/vfs";
export declare class Project extends EventTarget implements IDisposable {
    #private;
    loaded: Barrier;
    settings: ProjectSettings;
    dispose(): void;
    load(fs: VirtualFileSystem): Promise<void>;
    files(): Generator<any, void, undefined>;
    file_by_name(name: string): any;
    boards(): Generator<any, void, unknown>;
    get has_boards(): boolean;
    schematics(): Generator<any, void, unknown>;
    get has_schematics(): boolean;
    pages(): Generator<ProjectPage, void, undefined>;
    get first_page(): ProjectPage | undefined;
    get root_schematic_page(): ProjectPage | undefined;
    page_by_path(project_path: string): ProjectPage | undefined;
    download(name: string): Promise<void>;
    get active_page(): ProjectPage | null;
    set_active_page(page_or_path: ProjectPage | string | null | undefined): void;
}
export declare class ProjectPage {
    project: Project;
    type: "pcb" | "schematic";
    filename: string;
    sheet_path: string;
    name?: string | undefined;
    page?: string | undefined;
    constructor(project: Project, type: "pcb" | "schematic", filename: string, sheet_path: string, name?: string | undefined, page?: string | undefined);
    /**
     * A unique identifier for this page within the project,
     * made from the filename and sheet path.
     */
    get project_path(): string;
    get document(): any;
}
