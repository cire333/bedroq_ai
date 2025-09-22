export declare class BaseAPIError extends Error {
    name: string;
    url: string;
    description: string;
    response?: Response | undefined;
    constructor(name: string, url: string, description: string, response?: Response | undefined);
}
export declare class UnknownError extends BaseAPIError {
    constructor(url: string, description: string, response: Response);
}
export declare class NotFoundError extends BaseAPIError {
    constructor(url: string, response: Response);
}
export declare class GitHub {
    static readonly html_base_url = "https://github.com";
    static readonly base_url = "https://api.github.com/";
    static readonly api_version = "2022-11-28";
    static readonly accept_header = "application/vnd.github+json";
    headers: Record<string, string>;
    last_response?: Response;
    rate_limit_remaining?: number;
    constructor();
    /**
     * Parse an html (user-facing) URL
     */
    static parse_url(url: string | URL): {
        owner: string | undefined;
        repo: string | undefined;
        type: string | undefined;
        ref: string | undefined;
        path: string | undefined;
    } | null;
    request(path: string, params?: Record<string, string>, data?: unknown): Promise<unknown>;
    handle_server_error(response: Response): Promise<void>;
    repos_contents(owner: string, repo: string, path: string, ref?: string): Promise<unknown>;
}
export declare class GitHubUserContent {
    static readonly base_url = "https://raw.githubusercontent.com/";
    constructor();
    get(url_or_path: string | URL): Promise<File>;
    /**
     * Converts GitHub UI paths to valid paths for raw.githubusercontent.com.
     *
     * https://github.com/wntrblm/Helium/blob/main/hardware/board/board.kicad_sch
     * becomes
     * https://raw.githubusercontent.com/wntrblm/Helium/main/hardware/board/board.kicad_sch
     */
    convert_url(url: string | URL): URL;
}
