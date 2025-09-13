import * as React from 'react';
import type {} from '@mui/x-date-pickers/themeAugmentation';
import type {} from '@mui/x-charts/themeAugmentation';
import type {} from '@mui/x-data-grid-pro/themeAugmentation';
import type {} from '@mui/x-tree-view/themeAugmentation';
import Typography from '@mui/material/Typography';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import AppNavbar from '../components/AppNavbar';
import Header from '../components/Header';
import ProjectGrid from '../components/grids/ProjectGrid';
import SideMenu from '../components/SideMenu';
import AppTheme from '../../shared-theme/AppTheme';
import {
  chartsCustomizations,
  dataGridCustomizations,
  datePickersCustomizations,
  treeViewCustomizations,
} from '../theme/customizations';
import { KiCanvasViewer } from '../components/kicanvas/KiCanvasViewer';
import Copyright from '../internals/components/Copyright';

const xThemeComponents = {
  ...chartsCustomizations,
  ...dataGridCustomizations,
  ...datePickersCustomizations,
  ...treeViewCustomizations,
};

export const ProjectContainer:React.FC = () => {
  return (
    <AppTheme themeComponents={xThemeComponents}>
      <CssBaseline enableColorScheme />
      <Box sx={{ display: 'flex' }}>
        <SideMenu />
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
            <ProjectGrid />
            
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
              Project Overview
            </Typography>
              <KiCanvasViewer
                      src="/files/connections.kicad_sch"
                      showToolbar={true}
                      showStatusBar={true}
                      onLoad={(controller) => {
                        console.log('KiCanvas loaded!', controller);
                      }}
                      onError={(error) => {
                        console.error('Failed to load:', error);
                      }}
                    />
            
          </Stack>
        </Box>
      </Box>
      <Copyright sx={{ my: 4 }} />
    </AppTheme>
  );
}


// Cannot read properties of undefine (reading 'setTransform')