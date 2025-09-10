import type { IDisposable } from "../../base/disposable";
/**
 * Basic helpers for interacting with WebGL2
 */
type ParametersExceptFirst<F> = F extends (arg0: any, ...rest: infer R) => any ? R : never;
/**
 * Encapsulates a shader uniform, making it easier to set values.
 *
 * @example
 * u_color = new Uniform(gl, "u_color", u_color_location);
 * u_color.f4(1, 0, 1, 1);
 *
 */
declare class Uniform {
    gl: WebGL2RenderingContext;
    name: string;
    location: WebGLUniformLocation;
    type: GLenum;
    constructor(gl: WebGL2RenderingContext, name: string, location: WebGLUniformLocation, type: GLenum);
    f1(x: number): void;
    f1v(data: Float32List, srcOffset?: GLuint, srcLength?: GLuint): void;
    f2(...args: ParametersExceptFirst<WebGLRenderingContextBase["uniform2f"]>): void;
    f2v(...args: ParametersExceptFirst<WebGL2RenderingContext["uniform2fv"]>): void;
    f3(...args: ParametersExceptFirst<WebGL2RenderingContext["uniform3f"]>): void;
    f3v(...args: ParametersExceptFirst<WebGL2RenderingContext["uniform3fv"]>): void;
    f4(...args: ParametersExceptFirst<WebGL2RenderingContext["uniform4f"]>): void;
    f4v(...args: ParametersExceptFirst<WebGL2RenderingContext["uniform4fv"]>): void;
    mat3f(...args: ParametersExceptFirst<WebGL2RenderingContext["uniformMatrix3fv"]>): void;
    mat3fv(...args: ParametersExceptFirst<WebGL2RenderingContext["uniformMatrix3fv"]>): void;
}
/**
 * A shader program consisting of a vertex shader, fragment shader, and uniforms.
 */
export declare class ShaderProgram {
    #private;
    gl: WebGL2RenderingContext;
    name: string;
    vertex: WebGLShader;
    fragment: WebGLShader;
    program: WebGLProgram;
    /** Shader uniforms */
    uniforms: Record<string, Uniform>;
    /** Shader attributes */
    attribs: Record<string, WebGLActiveInfo>;
    /**
     * Create and compile a shader program
     * @param name - used for caching and identifying the shader
     * @param vertex - vertex shader source code
     * @param fragment - fragment shader source code
     */
    constructor(gl: WebGL2RenderingContext, name: string, vertex: WebGLShader, fragment: WebGLShader);
    [key: string]: any | Uniform;
    /**
     * Load vertex and fragment shader sources from URLs and compile them
     * into a new ShaderProgram
     * @param name used for caching and identifying the shader.
     */
    static load(gl: WebGL2RenderingContext, name: string, vert_src: URL | string, frag_src: URL | string): Promise<ShaderProgram>;
    /**
     * Compiles a shader
     *
     * Typically not used directly, use load() instead.
     *
     * @param gl
     * @param type - gl.FRAGMENT_SHADER or gl.VERTEX_SHADER
     * @param source
     */
    static compile(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader;
    /**
     * Link a vertex and fragment shader into a shader program.
     *
     * Typically not used directly, use load() instead.
     */
    static link(gl: WebGL2RenderingContext, vertex: WebGLShader, fragment: WebGLShader): WebGLProgram;
    /** use this shader for drawing */
    bind(): void;
}
/**
 * Manages vertex array objects (VAOs) and associated buffers.
 */
export declare class VertexArray implements IDisposable {
    gl: WebGL2RenderingContext;
    vao?: WebGLVertexArrayObject;
    buffers: Buffer[];
    /**
     * Create a VertexArray
     * @param {WebGL2RenderingContext} gl
     */
    constructor(gl: WebGL2RenderingContext);
    /**
     * Free WebGL resources
     * @param include_buffers
     */
    dispose(include_buffers?: boolean): void;
    bind(): void;
    /**
     * Create a new buffer bound to this vertex array
     * @param attrib - shader attribute location
     * @param size - number of components per vertex attribute
     * @param type - data type for each component, if unspecified it's gl.FLOAT.
     * @param normalized - whether or not to normalize integer types when converting to float
     * @param stride - offset between consecutive attributes
     * @param offset - offset from the beginning of the array to the first attribute
     * @param target - binding point, typically gl.ARRAY_BUFFER (the default if unspecified)
     *      or gl.ELEMENT_ARRAY_BUFFER
     */
    buffer(attrib: GLint, size: GLint, type?: GLenum, normalized?: GLboolean, stride?: GLsizei, offset?: GLintptr, target?: GLenum): Buffer;
}
export type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;
export type TypedArrayLike = TypedArray | DataView | ArrayBuffer | SharedArrayBuffer;
/**
 * Manages a buffer of GPU data like vertices or colors
 */
export declare class Buffer implements IDisposable {
    #private;
    gl: WebGL2RenderingContext;
    target: GLenum;
    /**
     * Create a new buffer
     * @param target - binding point, typically gl.ARRAY_BUFFER (the default if unspecified)
     *      or gl.ELEMENT_ARRAY_BUFFER
     */
    constructor(gl: WebGL2RenderingContext, target?: GLenum);
    dispose(): void;
    /**
     * Binds the buffer to the current context
     */
    bind(): void;
    /**
     * Uploads data to the GPU buffer
     *
     * @param usage - intended usage pattern, typically gl.STATIC_DRAW
     *      (the default if unspecified) or gl.DYNAMIC_DRAW
     */
    set(data: TypedArrayLike, usage?: GLenum): void;
    /**
     * Gets the length of the buffer as reported by WebGL.
     */
    get length(): number;
}
export {};
