/**
 * Esbuild bundles these using the "text" content type. This tells typescript about it.
 */
declare module "*.kicad_pcb" {
    const value: string;
    export default value;
}
