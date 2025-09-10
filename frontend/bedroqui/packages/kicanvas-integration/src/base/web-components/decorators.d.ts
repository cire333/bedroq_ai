export declare function attribute<Type = unknown, TypeHint = unknown>(options: {
    type: TypeHint;
    converter?: AttributeConverter<Type, TypeHint>;
    on_change?: (old_value: Type | null, new_value: Type | null) => void;
}): (target: object, propertyKey: string | symbol) => void;
interface AttributeConverter<Type = unknown, TypeHint = unknown> {
    to_attribute(value: Type, type?: TypeHint): unknown;
    from_attribute(value: string | null, type?: TypeHint): Type;
}
export declare function query(selector: string, cache?: boolean): (target: object, propertyKey: string | symbol) => void;
export declare function query_all(selector: string): (target: object, propertyKey: string | symbol) => void;
export {};
