import * as React from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Copyright from '../internals/components/Copyright';
import ChartUserByCountry from './ChartUserByCountry';
import CustomizedTreeView from './CustomizedTreeView';
import CustomizedDataGrid from './CustomizedDataGrid';
import HighlightedCard from './HighlightedCard';
import PageViewsBarChart from './PageViewsBarChart';
import SessionsChart from './SessionsChart';
import StatCard, { StatCardProps } from './cards/GitCard';

const data: StatCardProps[] = [
  {
    mode: 'project-stats',
    title: 'Code Commits',
    value: '324',
    interval: 'Last 30 days',
    trend: 'up',
    projectName: 'IoT Device Manager',
    contributors: 5,
    lastCommit: '1 day ago',
    data: [
      200, 240, 220, 260, 240, 280, 300, 240, 280, 240, 300, 340, 320, 360, 340, 380,
      360, 400, 380, 420, 400, 440, 340, 460, 440, 480, 460, 500, 480, 520,
    ],
  }
];

export default function MainGrid() {
  const handleGitHubConnect = () => {
    console.log('Connecting to GitHub...');
    // Add your GitHub OAuth logic here
  };

  const handleFirmwareLink = () => {
    console.log('Linking firmware project...');
    // Add your firmware project linking logic here
  };

  const handleViewRepository = () => {
    console.log('Opening repository...');
    // Add your repository navigation logic here
  };

  return (
    <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
      {/* cards */}
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Development Overview
      </Typography>
      <Grid
        container
        spacing={2}
        columns={12}
        sx={{ mb: (theme) => theme.spacing(2) }}
      >
        {/* GitHub Connect Card - First */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            mode="github-connect"
            title="Connect GitHub"
            onGitHubConnect={handleGitHubConnect}
          />
        </Grid>
        
        {/* Firmware Link Card - Second */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            mode="firmware-link"
            title="Firmware Projects"
            onFirmwareLink={handleFirmwareLink}
            firmwareProjects={[
              { id: '1', name: 'ESP32 Controller', version: '1.2.3' },
              { id: '2', name: 'Arduino Sensor Hub', version: '2.1.0' },
            ]}
          />
        </Grid>

        {/* Project Stats Cards */}
        {data.map((card, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard
              {...card}
              onViewRepository={handleViewRepository}
            />
          </Grid>
        ))}
        
        {/* Keep the existing HighlightedCard */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <HighlightedCard />
        </Grid>
        
        <Grid size={{ xs: 12, md: 6 }}>
          <SessionsChart />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <PageViewsBarChart />
        </Grid>
      </Grid>
      
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Project Details
      </Typography>
      <Grid container spacing={2} columns={12}>
        <Grid size={{ xs: 12, lg: 9 }}>
          <CustomizedDataGrid />
        </Grid>
        <Grid size={{ xs: 12, lg: 3 }}>
          <Stack gap={2} direction={{ xs: 'column', sm: 'row', lg: 'column' }}>
            <CustomizedTreeView />
            <ChartUserByCountry />
          </Stack>
        </Grid>
      </Grid>
      <Copyright sx={{ my: 4 }} />
    </Box>
  );
}