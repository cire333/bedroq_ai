import { Angle } from "../../base/math";
import { At } from "../common";
import { EDAText } from "./eda-text";
/**
 * Represents text objects that belong to the schematic, not to any individual
 * symbol. These are created via the "Text" tool in Eeschema.
 *
 * This class is also used by the LabelPainter and PinPainter, specifically
 * for apply set_spin_style_from_angle. It might be possible to remove this
 * class altogether in favor of just have that method somewhere.
 */
export declare class SchText extends EDAText {
    constructor(text: string);
    apply_at(at: At): void;
    set_spin_style_from_angle(a: Angle): void;
    get shown_text(): string;
}
