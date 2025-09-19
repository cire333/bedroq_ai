import React, { useState } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import {
  Upload,
  Memory,
  Security,
  DeviceHub,
  NewReleases
} from '@mui/icons-material';

// Mock Header component for demonstration
const Header = () => (
  <Box sx={{ width: '100%', textAlign: 'center', mb: 2 }}>
    <Typography variant="h4" component="h1">
      Firmware Management
    </Typography>
  </Box>
);

// Mock Copyright component for demonstration
const Copyright = ({ sx }: { sx?: any }) => (
  <Typography variant="body2" color="text.secondary" align="center" sx={sx}>
    © 2024 Your Company. All rights reserved.
  </Typography>
);

// Mock data for firmware - replace with your actual data source
const mockFirmwareData = [
  {
    id: 1,
    version: 'v2.4.1',
    hardware: ['ESP32-S3', 'ESP32-C3'],
    publisher: 'John Smith',
    publishedDate: '2024-09-10',
    branch: 'main',
    repository: 'firmware-core',
    repositoryType: 'github',
    buildNumber: '2024.09.10.1',
    status: 'stable',
    description: 'Security patches and performance improvements',
    fileSize: '2.3 MB'
  },
  {
    id: 2,
    version: 'v2.4.0',
    hardware: ['ESP32-S3', 'ESP32-C3', 'ESP32'],
    publisher: 'Sarah Johnson',
    publishedDate: '2024-09-05',
    branch: 'release/2.4',
    repository: 'firmware-core',
    repositoryType: 'gitlab',
    buildNumber: '2024.09.05.3',
    status: 'stable',
    description: 'Major feature release with new IoT capabilities',
    fileSize: '2.5 MB'
  },
  {
    id: 3,
    version: 'v2.5.0-beta.1',
    hardware: ['ESP32-S3'],
    publisher: 'Mike Chen',
    publishedDate: '2024-09-12',
    branch: 'develop',
    repository: 'firmware-experimental',
    repositoryType: 'github',
    buildNumber: '2024.09.12.1',
    status: 'beta',
    description: 'Beta release with experimental AI features',
    fileSize: '2.8 MB'
  }
];

// Mock CustomizedDataGrid component - replace with your actual component
const CustomizedDataGrid = ({ data }: { data?: any[] }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Firmware Versions
        </Typography>
        {/* Your actual CustomizedDataGrid would go here */}
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            CustomizedDataGrid will display {data?.length || 0} firmware entries here.
            Replace this mock with your actual CustomizedDataGrid component.
          </Typography>
          {data && data.slice(0, 3).map((firmware, index) => (
            <Box key={index} sx={{ mt: 1, p: 1, bgcolor: 'white', borderRadius: 0.5 }}>
              <Typography variant="body2">
                <strong>{firmware.version}</strong> - {firmware.description}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Published by {firmware.publisher} on {firmware.publishedDate}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export const FirmwareContainer: React.FC = () => {
  const [firmwareData] = useState(mockFirmwareData);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    version: '',
    hardware: [] as string[],
    description: '',
    branch: '',
    repository: '',
    repositoryType: 'github'
  });

  // Calculate overview statistics
  const stats = {
    totalFirmware: firmwareData.length,
    stableVersions: firmwareData.filter(f => f.status === 'stable').length,
    supportedHardware: [...new Set(firmwareData.flatMap(f => f.hardware))].length,
    latestVersion: firmwareData
      .filter(f => f.status === 'stable')
      .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())[0]?.version || 'N/A'
  };

  const handleUploadClick = () => {
    setUploadDialogOpen(true);
  };

  const handleUploadClose = () => {
    setUploadDialogOpen(false);
    setUploadForm({
      version: '',
      hardware: [],
      description: '',
      branch: '',
      repository: '',
      repositoryType: 'github'
    });
  };

  const handleUploadSubmit = () => {
    // Handle firmware upload logic here
    console.log('Uploading firmware:', uploadForm);
    handleUploadClose();
  };

  const handleHardwareChange = (value: string[]) => {
    setUploadForm(prev => ({ ...prev, hardware: value }));
  };

  const availableHardware = ['ESP32', 'ESP32-S3', 'ESP32-C3', 'ESP32-H2', 'Arduino Uno', 'Raspberry Pi'];

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
        
        {/* Upload Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<Upload />}
            onClick={handleUploadClick}
            size="large"
            sx={{ px: 3 }}
          >
            Upload New Firmware
          </Button>
        </Box>

        {/* Overview Cards */}
        <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
          Firmware Overview
        </Typography>
        <Grid
          container
          spacing={2}
          columns={12}
          sx={{ mb: (theme) => theme.spacing(2) }}
        >
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ pb: '16px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Memory color="primary" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Total Firmware
                  </Typography>
                </Box>
                <Typography variant="h4" component="div">
                  {stats.totalFirmware}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Available versions
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ pb: '16px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Security color="success" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Stable Versions
                  </Typography>
                </Box>
                <Typography variant="h4" component="div">
                  {stats.stableVersions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Production ready
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ pb: '16px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <DeviceHub color="info" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Hardware Types
                  </Typography>
                </Box>
                <Typography variant="h4" component="div">
                  {stats.supportedHardware}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Supported devices
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ pb: '16px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <NewReleases color="warning" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Latest Stable
                  </Typography>
                </Box>
                <Typography variant="h4" component="div" sx={{ fontSize: '1.8rem' }}>
                  {stats.latestVersion}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current version
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Details and Versions */}
        <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
          Details and Versions
        </Typography>
        <Grid container spacing={2} columns={12}>
          <Grid item xs={12} lg={9}>
            <CustomizedDataGrid data={firmwareData} />
          </Grid>
        </Grid>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onClose={handleUploadClose} maxWidth="md" fullWidth>
          <DialogTitle>Upload New Firmware Version</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label="Version"
                value={uploadForm.version}
                onChange={(e) => setUploadForm(prev => ({ ...prev, version: e.target.value }))}
                placeholder="e.g., v2.5.0"
                fullWidth
              />
              
              <FormControl fullWidth>
                <InputLabel>Hardware Compatibility</InputLabel>
                <Select
                  multiple
                  value={uploadForm.hardware}
                  onChange={(e) => handleHardwareChange(e.target.value as string[])}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {availableHardware.map((hw) => (
                    <MenuItem key={hw} value={hw}>
                      {hw}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={3}
                fullWidth
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>Repository Type</InputLabel>
                  <Select
                    value={uploadForm.repositoryType}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, repositoryType: e.target.value }))}
                  >
                    <MenuItem value="github">GitHub</MenuItem>
                    <MenuItem value="gitlab">GitLab</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Repository"
                  value={uploadForm.repository}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, repository: e.target.value }))}
                  placeholder="e.g., firmware-core"
                  sx={{ flex: 1 }}
                />
              </Box>

              <TextField
                label="Branch"
                value={uploadForm.branch}
                onChange={(e) => setUploadForm(prev => ({ ...prev, branch: e.target.value }))}
                placeholder="e.g., main, develop, feature/new-feature"
                fullWidth
              />

              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  📁 Drag and drop firmware files here, or click to browse
                </Typography>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleUploadClose}>Cancel</Button>
            <Button 
              onClick={handleUploadSubmit} 
              variant="contained"
              disabled={!uploadForm.version || uploadForm.hardware.length === 0}
            >
              Upload Firmware
            </Button>
          </DialogActions>
        </Dialog>

        <Copyright sx={{ my: 4 }} />
      </Box>
    </Stack>
  );
};