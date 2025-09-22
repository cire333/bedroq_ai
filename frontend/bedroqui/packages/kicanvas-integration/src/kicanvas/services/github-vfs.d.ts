import { VirtualFileSystem } from "./vfs";
/**
 * Virtual file system for GitHub.
 */
export declare class GitHubFileSystem extends VirtualFileSystem {
    private files_to_urls;
    constructor(files_to_urls: Map<string, URL>);
    static fromURLs(...urls: (string | URL)[]): Promise<GitHubFileSystem>;
    list(): Generator<string, void, undefined>;
    get(name: string): Promise<File>;
    has(name: string): Promise<boolean>;
    download(name: string): Promise<void>;
}
