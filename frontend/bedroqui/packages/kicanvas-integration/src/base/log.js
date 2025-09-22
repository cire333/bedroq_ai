/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 2] = "DEBUG";
})(LogLevel || (LogLevel = {}));
export class Logger {
    constructor(name, level = LogLevel.INFO) {
        this.name = name;
        this.level = level;
    }
    #log(method, ...args) {
        method(`%c${this.name}:%c`, `color: ButtonText`, `color: inherit`, ...args);
    }
    debug(...args) {
        if (this.level >= LogLevel.DEBUG) {
            this.#log(console.debug, ...args);
        }
    }
    info(...args) {
        if (this.level >= LogLevel.INFO) {
            this.#log(console.info.bind(window.console), ...args);
        }
    }
    warn(...args) {
        if (this.level >= LogLevel.ERROR) {
            this.#log(console.warn, ...args);
        }
    }
    error(...args) {
        if (this.level >= LogLevel.ERROR) {
            this.#log(console.error, ...args);
        }
    }
}
const default_logger = new Logger("kicanvas");
export function debug(...args) {
    default_logger.debug(...args);
}
export function info(...args) {
    default_logger.info(...args);
}
export function warn(...args) {
    default_logger.warn(...args);
}
export function error(...args) {
    default_logger.error(...args);
}
