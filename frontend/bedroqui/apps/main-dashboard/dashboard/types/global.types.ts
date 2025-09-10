
// types.ts - Add breadcrumb types
export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface RouteConfig {
  path: string;
  breadcrumbs: BreadcrumbItem[];
}