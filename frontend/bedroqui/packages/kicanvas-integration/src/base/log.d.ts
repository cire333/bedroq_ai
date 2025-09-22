export declare enum LogLevel {
    ERROR = 0,
    INFO = 1,
    DEBUG = 2
}
export declare class Logger {
    #private;
    readonly name: string;
    level: LogLevel;
    constructor(name: string, level?: LogLevel);
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
}
export declare function debug(...args: any[]): void;
export declare function info(...args: any[]): void;
export declare function warn(...args: any[]): void;
export declare function error(...args: any[]): void;
