import React from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Header from '../components/Header';
import Copyright from '../internals/components/Copyright';
import DeviceDataGrid from '../components/grids/DeviceDataGrid';
import CssBaseline from '@mui/material/CssBaseline';
import AppTheme from '../../shared-theme/AppTheme';
import {
  DevicesOther as DevicesIcon,
  CheckCircle as OnlineIcon,
  Cancel as OfflineIcon,
  Warning as WarningIcon,
  Update as UpdateIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

import {
  chartsCustomizations,
  dataGridCustomizations,
  datePickersCustomizations,
  treeViewCustomizations,
} from '../theme/customizations';

const xThemeComponents = {
  ...chartsCustomizations,
  ...dataGridCustomizations,
  ...datePickersCustomizations,
  ...treeViewCustomizations,
};

// Sample device summary stats - replace with your actual data
const deviceStats = {
  total: 147,
  online: 132,
  offline: 8,
  warning: 7,
  needsUpdate: 15,
};

export const DevicesContainer: React.FC = () => {
  const theme = useTheme();

  return (
    <AppTheme themeComponents={xThemeComponents}>
      <CssBaseline enableColorScheme />
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
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
          
          {/* Device Summary Cards */}
          <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
            Device Fleet Overview
          </Typography>
          <Grid
            container
            spacing={2}
            columns={12}
            sx={{ mb: 4 }}
          >
            <Grid size={{ xs: 6, sm: 3, lg: 2.4 }}>
              <Card sx={{ textAlign: 'center', py: 1 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <DevicesIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="h4" color="primary">
                    {deviceStats.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Devices
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 6, sm: 3, lg: 2.4 }}>
              <Card sx={{ textAlign: 'center', py: 1 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <OnlineIcon color="success" sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="h4" color="success.main">
                    {deviceStats.online}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Online
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 6, sm: 3, lg: 2.4 }}>
              <Card sx={{ textAlign: 'center', py: 1 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <OfflineIcon color="error" sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="h4" color="error.main">
                    {deviceStats.offline}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Offline
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 6, sm: 3, lg: 2.4 }}>
              <Card sx={{ textAlign: 'center', py: 1 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <WarningIcon color="warning" sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="h4" color="warning.main">
                    {deviceStats.warning}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Warning
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 6, sm: 3, lg: 2.4 }}>
              <Card sx={{ textAlign: 'center', py: 1 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <UpdateIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="h4" color="info.main">
                    {deviceStats.needsUpdate}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Need Updates
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Device Data Grid - More Prominent */}
          <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
            Device Fleet
          </Typography>
          
          <Paper 
            elevation={2}
            sx={{ 
              borderRadius: 2,
              overflow: 'hidden',
              '& .MuiDataGrid-root': {
                border: 'none',
              }
            }}
          >
            <Box sx={{ width: '100%', minHeight: 600 }}>
              {/* <DeviceDataGrid /> */}
            </Box>
          </Paper>

          <Copyright sx={{ my: 4 }} />
        </Box>
      </Stack>
    </AppTheme>
  );
};