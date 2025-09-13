// breadcrumbConfig.ts - Configuration for route breadcrumbs
import { RouteConfig } from '../types/global.types';

export const routeConfigs: RouteConfig[] = [
  {
    path: '/',
    breadcrumbs: [
      { label: 'Dashboard' },
      { label: 'Home' }
    ]
  },
  {
    path: '/users',
    breadcrumbs: [
      { label: 'Dashboard', path: '/' },
      { label: 'Users' }
    ]
  },
  {
    path: '/projects',
    breadcrumbs: [
      { label: 'Dashboard', path: '/' },
      { label: 'Projects' }
    ]
  },
  {
    path: '/users/:id',
    breadcrumbs: [
      { label: 'Dashboard', path: '/' },
      { label: 'Users', path: '/users' },
      { label: 'User Details' }
    ]
  },
  {
    path: '/analytics',
    breadcrumbs: [
      { label: 'Dashboard', path: '/' },
      { label: 'Analytics' }
    ]
  },
  {
    path: '/integrations',
    breadcrumbs: [
      { label: 'Dashboard', path: '/' },
      { label: 'Integrations' }
    ]
  },
  {
    path: '/settings',
    breadcrumbs: [
      { label: 'Dashboard', path: '/' },
      { label: 'Settings' }
    ]
  },
  {
    path: '/devices',
    breadcrumbs: [
      { label: 'Dashboard', path: '/' },
      { label: 'Devices' }
    ]
  }

];

// Helper function to find matching route config
export const findRouteConfig = (pathname: string): RouteConfig | null => {
  // First try exact match
  const exactMatch = routeConfigs.find(config => config.path === pathname);
  if (exactMatch) return exactMatch;
  
  // Then try pattern match for dynamic routes (like /users/:id)
  const patternMatch = routeConfigs.find(config => {
    if (!config.path.includes(':')) return false;
    
    const pattern = config.path.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(pathname);
  });
  
  return patternMatch || null;
};