import React from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Header from '../components/Header';
import Copyright from '../internals/components/Copyright';
import CustomizedDataGrid from '../components/CustomizedDataGrid';


export const ConfigurationsContainer: React.FC = () => {
  return (
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
      {/* cards */}
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Configuration Overview
      </Typography>
      <Grid
        container
        spacing={2}
        columns={12}
        sx={{ mb: (theme) => theme.spacing(2) }}
      >
      </Grid>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Configurations and Versions
      </Typography>
      <Grid container spacing={2} columns={12}>
        <Grid size={{ xs: 12, lg: 9 }}>
          <CustomizedDataGrid />
        </Grid>
      </Grid>
      <Copyright sx={{ my: 4 }} />
    </Box>
    </Stack>
  );
};