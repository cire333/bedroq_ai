import { BBox, Matrix3, Vec2 } from "../../base/math";
import { EDAText } from "./eda-text";
type Parent = {
    position: Vec2;
    transform: Matrix3;
    is_symbol: boolean;
};
/**
 * Represents a symbol (or sheet) "field", such as the reference, value, or
 * other properties shown along with the symbol.
 *
 * This corresponds to and is roughly based on KiCAD's SCH_FIELD class.
 */
export declare class SchField extends EDAText {
    parent?: Parent | undefined;
    constructor(text: string, parent?: Parent | undefined);
    get shown_text(): string;
    /** Get effective rotation when drawing, taking into the parent position
     * orientation, and transformation.
     */
    get draw_rotation(): any;
    get position(): Vec2;
    get bounding_box(): BBox;
}
export {};
