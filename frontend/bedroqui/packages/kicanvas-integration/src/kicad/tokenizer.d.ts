export declare class Token {
    type: symbol;
    value: any;
    static OPEN: symbol;
    static CLOSE: symbol;
    static ATOM: symbol;
    static NUMBER: symbol;
    static STRING: symbol;
    /**
     * Create a new Token
     */
    constructor(type: symbol, value?: any);
}
export declare function tokenize(input: string): Generator<Token, void, unknown>;
export type List = (string | number | List)[];
export declare function listify(src: string): List;
