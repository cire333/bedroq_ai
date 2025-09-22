declare function earcut(data: any, holeIndices: any, dim: any): any[];
declare namespace earcut {
    function deviation(data: any, holeIndices: any, dim: any, triangles: any): number;
    function flatten(data: any): {
        vertices: never[];
        holes: never[];
        dimensions: any;
    };
}
export default earcut;
