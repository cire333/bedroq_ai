/**
 * Virtual file system abstract class.
 *
 * This is the interface used by <kc-kicanvas-shell> to find and load files.
 * It's implemented using Drag and Drop and GitHub to provide a common interface
 * for interacting and loading files.
 */
export declare abstract class VirtualFileSystem {
    abstract list(): Generator<string>;
    abstract get(name: string): Promise<File>;
    abstract has(name: string): Promise<boolean>;
    abstract download(name: string): Promise<void>;
    list_matches(r: RegExp): Generator<string, void, unknown>;
    list_ext(ext: string): Generator<string, void, unknown>;
}
/**
 * Virtual file system for URLs via Fetch
 */
export declare class FetchFileSystem extends VirtualFileSystem {
    #private;
    private urls;
    private resolver;
    constructor(urls: (string | URL)[], resolve_file?: ((name: string) => URL) | null);
    list(): Generator<string, void, undefined>;
    has(name: string): Promise<boolean>;
    get(name: string): Promise<File>;
    download(name: string): Promise<void>;
}
/**
 * Virtual file system for HTML drag and drop (DataTransfer)
 */
export declare class DragAndDropFileSystem extends VirtualFileSystem {
    private items;
    constructor(items: FileSystemFileEntry[]);
    static fromDataTransfer(dt: DataTransfer): Promise<DragAndDropFileSystem>;
    list(): Generator<string, void, unknown>;
    has(name: string): Promise<boolean>;
    get(name: string): Promise<File>;
    download(name: string): Promise<void>;
}
