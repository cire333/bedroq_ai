import { Renderer } from "../../graphics";
import * as board_items from "../../kicad/board";
import { DocumentPainter } from "../base/painter";
import { LayerSet } from "./layers";
import type { BoardTheme } from "../../kicad";
export declare class BoardPainter extends DocumentPainter {
    theme: BoardTheme;
    constructor(gfx: Renderer, layers: LayerSet, theme: BoardTheme);
    filter_net: number | null;
    paint_net(board: board_items.KicadPCB, net: number): void;
}
