import { KCUIElement } from "../../../kc-ui";
import type { Project } from "../../project";
export declare class KCProjectPanelElement extends KCUIElement {
    #private;
    static styles: any[];
    project: Project;
    connectedCallback(): void;
    initialContentCallback(): void;
    get selected(): string | null;
    set selected(name: string | null);
    private change_current_project_page;
    render(): any;
}
