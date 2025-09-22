/**
 * Helper for managing "flag" attributes. These are html attributes that contain
 * a list of flags, for example, controlslist="download nofullscreen".
 */
export declare function parseFlagAttribute<T>(value: string, dst: T): T;
