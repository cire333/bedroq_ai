import * as React from 'react';
import { useState } from 'react';
import type {} from '@mui/x-date-pickers/themeAugmentation';
import type {} from '@mui/x-charts/themeAugmentation';
import type {} from '@mui/x-data-grid-pro/themeAugmentation';
import type {} from '@mui/x-tree-view/themeAugmentation';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import Drawer from '@mui/material/Drawer';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import ChatInterface from './ChatInterface.tsx';

import AppNavbar from '../components/AppNavbar';
import Header from '../components/Header';
import SideMenu from '../components/SideMenu';
import AppTheme from '../../shared-theme/AppTheme';
import {
  chartsCustomizations,
  dataGridCustomizations,
  datePickersCustomizations,
  treeViewCustomizations,
} from '../theme/customizations';
import { KiCanvasViewer } from '../components/kicanvas/KiCanvasViewer';
import KiCanvasTest from '../components/kicanvas/KiCanvasBase';
import Copyright from '../internals/components/Copyright';

const xThemeComponents = {
  ...chartsCustomizations,
  ...dataGridCustomizations,
  ...datePickersCustomizations,
  ...treeViewCustomizations,
};

export const ReviewContainer: React.FC = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const theme = useTheme();

  const handleChatToggle = () => {
    setChatOpen(!chatOpen);
  };

  const drawerWidth = '30vw'; // Half the screen width

  return (
    <AppTheme themeComponents={xThemeComponents}>
      <CssBaseline enableColorScheme />
      <Box sx={{ display: 'flex', position: 'relative', minHeight: '100vh' }}>
        <Header />
        
        {/* Main Content Area */}
        <Box 
          sx={{ 
            flexGrow: 1,
            transition: theme.transitions.create(['margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            marginRight: chatOpen ? drawerWidth : 0,
          }}
        >
          <div style={{ height: '100vh' }}>
            <KiCanvasTest src="/kicad-files/connections.kicad_sch" />
          </div>
        </Box>

        {/* Chat Drawer */}
        <Drawer
          variant="persistent"
          anchor="right"
          open={chatOpen}
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              top: 0, // Adjust based on your header height
              height: 'calc(100vh - 0px)',
              borderRight: `1px solid ${theme.palette.divider}`,
            },
          }}
        >
          {/* Chat Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
              bgcolor: 'background.paper',
              zIndex: 1,
            }}
          >
            <Typography variant="h6" component="h2">
              Bedroq Assistant
            </Typography>
            <IconButton onClick={handleChatToggle} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Chat Interface - Full Height */}
          <Box sx={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
            <ChatInterface />
          </Box>
        </Drawer>

        {/* Floating Action Button */}
        <Fab
          color="primary"
          aria-label="open chat"
          onClick={handleChatToggle}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: theme.zIndex.fab,
            display: chatOpen ? 'none' : 'flex',
          }}
        >
          <ChatIcon />
        </Fab>

        <Copyright sx={{ my: 4 }} />
      </Box>
    </AppTheme>
  );
};

// http://localhost:3000/kicad-files/connections.kicad_sch