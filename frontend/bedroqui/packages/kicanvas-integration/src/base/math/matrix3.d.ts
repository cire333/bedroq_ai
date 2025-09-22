import { Vec2 } from "./vec2";
import { Angle, type AngleLike } from "./angle";
type ElementArray = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];
/**
 * A 3x3 transformation matrix
 */
export declare class Matrix3 {
    elements: Float32Array;
    /**
     * Create a new Matrix
     * @param elements the 9 matrix elements
     */
    constructor(elements: ElementArray | Float32Array);
    /**
     * Create a Matrix3 from a DOMMatrix
     */
    static from_DOMMatrix(m: DOMMatrix): Matrix3;
    /**
     * Create a DOMMatrix from this Matrix3
     */
    to_DOMMatrix(): DOMMatrix;
    /**
     * Create a 4x4 DOMMatrix from this Matrix3
     */
    to_4x4_DOMMatrix(): DOMMatrix;
    /**
     * @returns a new identity matrix
     */
    static identity(): Matrix3;
    /**
     * @returns a new matrix representing a 2d orthographic projection
     */
    static orthographic(width: number, height: number): Matrix3;
    /**
     * @returns a copy of this matrix
     */
    copy(): Matrix3;
    /**
     * Update this matrix's elements
     */
    set(elements: Float32Array | ElementArray): void;
    /**
     * Transform a vector by multiplying it with this matrix.
     * @returns A new Vec2
     */
    transform(vec: Vec2): Vec2;
    /**
     * Transforms a list of vectors
     * @yields new transformed vectors
     */
    transform_all(vecs: Iterable<Vec2>): Generator<Vec2, void, unknown>;
    /**
     * Transforms a list of vector by a given matrix, which may be null.
     */
    static transform_all(mat: Matrix3 | null, vecs: Vec2[]): Vec2[];
    /**
     * Multiply this matrix by another and store the result
     * in this matrix.
     * @returns this matrix
     */
    multiply_self(b: Matrix3): this;
    /**
     * Create a new matrix by multiplying this matrix with another
     * @returns a new matrix
     */
    multiply(b: Matrix3): Matrix3;
    /**
     * @returns A new matrix that is the inverse of this matrix
     */
    inverse(): Matrix3;
    /**
     * @returns A new matrix representing a 2d translation
     */
    static translation(x: number, y: number): Matrix3;
    /**
     * Translate this matrix by the given amounts
     * @returns this matrix
     */
    translate_self(x: number, y: number): this;
    /**
     * Creates a new matrix representing this matrix translated by the given amount
     * @returns a new matrix
     */
    translate(x: number, y: number): Matrix3;
    /**
     * @returns {Matrix3} A new matrix representing a 2d scale
     */
    static scaling(x: number, y: number): Matrix3;
    /**
     * Scale this matrix by the given amounts
     * @returns this matrix
     */
    scale_self(x: number, y: number): this;
    /**
     * Creates a new matrix representing this matrix scaled by the given amount
     * @returns a new matrix
     */
    scale(x: number, y: number): Matrix3;
    /**
     * @returns A new matrix representing a 2d rotation
     */
    static rotation(angle: AngleLike): Matrix3;
    /**
     * Rotate this matrix by the given angle
     * @returns this matrix
     */
    rotate_self(angle: AngleLike): this;
    /**
     * Creates a new matrix representing this matrix rotated by the given angle
     * @returns a new matrix
     */
    rotate(angle: AngleLike): Matrix3;
    /**
     * Returns the total translation (relative to identity) applied via this matrix.
     */
    get absolute_translation(): Vec2;
    /**
     * Retruns the total rotation (relative to identity) applied via this matrix.
     */
    get absolute_rotation(): Angle;
}
export {};
