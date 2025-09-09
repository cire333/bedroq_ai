// packages/shared-ui/theme/index.ts
import { createTheme } from '@mui/material/styles';

export const unifiedTheme = createTheme({
  // Material-UI base theme
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' }
  },
  components: {
    // Override components for consistency
    MuiPaper: {
      styleOverrides: {
        root: {
          // Consistent paper styling for all embedded components
        }
      }
    }
  }
});

// Custom CSS variables for KiCanvas integration
export const kicanvasThemeVars = {
  '--kc-primary-color': '#1976d2',
  '--kc-background-color': '#fafafa'
};