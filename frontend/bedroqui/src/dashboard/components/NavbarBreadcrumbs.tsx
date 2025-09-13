import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Breadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import { findRouteConfig } from '../config/breadcrumbConfig';
import { BreadcrumbItem } from '../types/global.types';

const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  [`& .${breadcrumbsClasses.separator}`]: {
    color: (theme).palette.action.disabled,
    margin: 1,
  },
  [`& .${breadcrumbsClasses.ol}`]: {
    alignItems: 'center',
  },
}));

export default function NavbarBreadcrumbs(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

    // Get breadcrumbs for current route
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const routeConfig = findRouteConfig(location.pathname);
    
    if (!routeConfig) {
      // Fallback breadcrumbs for unknown routes
      return [
        { label: 'Dashboard', path: '/' },
        { label: 'Page' }
      ];
    }

    let breadcrumbs = [...routeConfig.breadcrumbs];

    // Handle dynamic routes (like user details)
    if (location.pathname.includes('/users/') && params.id) {
      // You could fetch user name here and replace "User Details"
      // For now, we'll keep it generic or you can enhance this
      breadcrumbs = breadcrumbs.map(crumb => 
        crumb.label === 'User Details' 
          ? { ...crumb, label: `User #${params.id}` }
          : crumb
      );
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  const handleBreadcrumbClick = (path: string) => {
    navigate(path);
  };

  return (
    <StyledBreadcrumbs
      aria-label="breadcrumb"
      separator={<NavigateNextRoundedIcon fontSize="small" />}
    >
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        
        if (isLast || !crumb.path) {
          // Last item or item without path - render as text
          return (
            <Typography 
              key={index}
              variant="body1" 
              sx={{ 
                color: isLast ? 'text.primary' : 'text.secondary',
                fontWeight: isLast ? 600 : 400 
              }}
            >
              {crumb.label}
            </Typography>
          );
        }

        // Clickable breadcrumb item
        return (
          <Link
            key={index}
            component="button"
            variant="body1"
            onClick={() => handleBreadcrumbClick(crumb.path!)}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
                color: 'primary.main'
              }
            }}
          >
            {crumb.label}
          </Link>
        );
      })}
    </StyledBreadcrumbs>
  );
}