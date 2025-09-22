import * as React from 'react';
import type {} from '@mui/x-date-pickers/themeAugmentation';
import type {} from '@mui/x-charts/themeAugmentation';
import type {} from '@mui/x-data-grid-pro/themeAugmentation';
import type {} from '@mui/x-tree-view/themeAugmentation';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import AppNavbar from '../components/AppNavbar';
import Header from '../components/Header';
import BedroqGrid from '../components/grids/BedroqGrid';
import AppTheme from '../../shared-theme/AppTheme';
import {
  chartsCustomizations,
  dataGridCustomizations,
  datePickersCustomizations,
  treeViewCustomizations,
} from '../theme/customizations';
import Copyright from '../internals/components/Copyright';

const xThemeComponents = {
  ...chartsCustomizations,
  ...dataGridCustomizations,
  ...datePickersCustomizations,
  ...treeViewCustomizations,
};

export const ProjectsContainer:React.FC = () => {
  return (
    <AppTheme themeComponents={xThemeComponents}>
      <CssBaseline enableColorScheme />
      <Box sx={{ display: 'flex' }}>
        <AppNavbar />
        
        {/* Main content */}
        <Box
          component="main"
          sx={(theme) => ({
            flexGrow: 1,
            backgroundColor: theme.palette.mode === 'light' ? theme.palette.grey[100] : theme.palette.background.default,
            overflow: 'auto',
          })}
        >
          
          <Stack
            spacing={2}
            sx={{
              alignItems: 'center',
              mx: 3,
              pb: 5,
              mt: { xs: 8, md: 0 },
            }}
          >
            <Header />
            <BedroqGrid />
             
          </Stack>
        </Box>
      </Box>
      <Copyright sx={{ my: 4 }} />
    </AppTheme>
  );
}


// Cannot read properties of undefine (reading 'setTransform')