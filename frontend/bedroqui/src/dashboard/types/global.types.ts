
// types.ts - Add breadcrumb types
export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface RouteConfig {
  path: string;
  breadcrumbs: BreadcrumbItem[];
}

// src/types/kicanvas.d.ts
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'kicanvas-embed': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          controls?: 'none' | 'basic' | 'full';
          controlslist?: string;
          theme?: 'kicad' | 'witchhazel';
        },
        HTMLElement
      >;
      'kicanvas-source': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          type?: 'schematic' | 'board' | 'project';
        },
        HTMLElement
      >;
    }
  }

  interface Window {
    KiCanvasCore?: any;
  }
}