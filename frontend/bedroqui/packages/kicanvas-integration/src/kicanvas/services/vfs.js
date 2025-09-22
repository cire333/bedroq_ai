/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { initiate_download } from "../../base/dom/download";
import { basename } from "../../base/paths";
/**
 * Virtual file system abstract class.
 *
 * This is the interface used by <kc-kicanvas-shell> to find and load files.
 * It's implemented using Drag and Drop and GitHub to provide a common interface
 * for interacting and loading files.
 */
export class VirtualFileSystem {
    *list_matches(r) {
        for (const filename of this.list()) {
            if (filename.match(r)) {
                yield filename;
            }
        }
    }
    *list_ext(ext) {
        if (!ext.startsWith(".")) {
            ext = `.${ext}`;
        }
        for (const filename of this.list()) {
            if (filename.endsWith(ext)) {
                yield filename;
            }
        }
    }
}
/**
 * Virtual file system for URLs via Fetch
 */
export class FetchFileSystem extends VirtualFileSystem {
    #default_resolver(name) {
        const url = new URL(name, window.location.toString());
        return url;
    }
    #resolve(filepath) {
        if (typeof filepath === "string") {
            const cached_url = this.urls.get(filepath);
            if (cached_url) {
                return cached_url;
            }
            else {
                const url = this.resolver(filepath);
                const name = basename(url);
                this.urls.set(name, url);
                return url;
            }
        }
        return filepath;
    }
    constructor(urls, resolve_file = null) {
        super();
        this.urls = new Map();
        this.resolver = resolve_file ?? this.#default_resolver;
        for (const item of urls) {
            this.#resolve(item);
        }
    }
    *list() {
        yield* this.urls.keys();
    }
    async has(name) {
        return Promise.resolve(this.urls.has(name));
    }
    async get(name) {
        const url = this.#resolve(name);
        if (!url) {
            throw new Error(`File ${name} not found!`);
        }
        const request = new Request(url, { method: "GET" });
        const response = await fetch(request);
        if (!response.ok) {
            throw new Error(`Unable to load ${url}: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        return new File([blob], name);
    }
    async download(name) {
        initiate_download(await this.get(name));
    }
}
/**
 * Virtual file system for HTML drag and drop (DataTransfer)
 */
export class DragAndDropFileSystem extends VirtualFileSystem {
    constructor(items) {
        super();
        this.items = items;
    }
    static async fromDataTransfer(dt) {
        let items = [];
        // Pluck items out as webkit entries (either FileSystemFileEntry or
        // FileSystemDirectoryEntry)
        for (let i = 0; i < dt.items.length; i++) {
            const item = dt.items[i]?.webkitGetAsEntry();
            if (item) {
                items.push(item);
            }
        }
        // If it's just one directory then open it and set all of our items
        // to its contents.
        if (items.length == 1 && items[0]?.isDirectory) {
            const reader = items[0].createReader();
            items = [];
            await new Promise((resolve, reject) => {
                reader.readEntries((entries) => {
                    for (const entry of entries) {
                        if (!entry.isFile) {
                            continue;
                        }
                        items.push(entry);
                    }
                    resolve(true);
                }, reject);
            });
        }
        return new DragAndDropFileSystem(items);
    }
    *list() {
        for (const entry of this.items) {
            yield entry.name;
        }
    }
    async has(name) {
        for (const entry of this.items) {
            if (entry.name == name) {
                return true;
            }
        }
        return false;
    }
    async get(name) {
        let file_entry = null;
        for (const entry of this.items) {
            if (entry.name == name) {
                file_entry = entry;
                break;
            }
        }
        if (file_entry == null) {
            throw new Error(`File ${name} not found!`);
        }
        return await new Promise((resolve, reject) => {
            file_entry.file(resolve, reject);
        });
    }
    async download(name) {
        initiate_download(await this.get(name));
    }
}
