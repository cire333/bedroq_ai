import React, { useState } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Pagination from '@mui/material/Pagination';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import { useNavigate } from 'react-router-dom';

import {
  Add as AddIcon,
  Person as PersonIcon,
  MoreVert as MoreVertIcon,
  FolderOpen as ProjectIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

// Project interface
interface Project {
  id: string;
  title: string;
  owner: string;
  status: 'active' | 'completed' | 'on-hold' | 'planning';
  createdDate: Date;
  description?: string;
  progress?: number;
}

// Status color mapping
const getStatusColor = (status: Project['status']) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'completed':
      return 'primary';
    case 'on-hold':
      return 'warning';
    case 'planning':
      return 'info';
    default:
      return 'default';
  }
};

// Status display text
const getStatusText = (status: Project['status']) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    case 'on-hold':
      return 'On Hold';
    case 'planning':
      return 'Planning';
    default:
      return 'Unknown';
  }
};

// Sample data - replace with your actual data source
const mockProjects: Project[] = [
  {
    id: '1',
    title: 'IoT Device Manager',
    owner: 'John Smith',
    status: 'active',
    createdDate: new Date('2024-01-15'),
    description: 'Smart IoT device management system with real-time monitoring',
    progress: 75,
  },
  {
    id: '2',
    title: 'Sensor Network Hub',
    owner: 'Sarah Johnson',
    status: 'planning',
    createdDate: new Date('2024-02-20'),
    description: 'Centralized hub for managing multiple sensor networks',
  },
  {
    id: '3',
    title: 'Home Automation Controller',
    owner: 'Mike Chen',
    status: 'completed',
    createdDate: new Date('2023-12-10'),
    description: 'Complete home automation system with mobile app integration',
  },
  {
    id: '4',
    title: 'Weather Station Array',
    owner: 'Emily Davis',
    status: 'on-hold',
    createdDate: new Date('2024-01-08'),
    description: 'Distributed weather monitoring stations with data aggregation',
  },
  {
    id: '5',
    title: 'Smart Irrigation System',
    owner: 'David Wilson',
    status: 'active',
    createdDate: new Date('2024-03-01'),
    description: 'Automated irrigation system with soil moisture monitoring',
    progress: 45,
  },
  {
    id: '6',
    title: 'Industrial Monitor',
    owner: 'Lisa Anderson',
    status: 'planning',
    createdDate: new Date('2024-03-15'),
    description: 'Industrial equipment monitoring and predictive maintenance',
  },
];

interface BedroqGridProps {
  projects?: Project[];
  onCreateProject?: () => void;
  onProjectClick?: (project: Project) => void;
  onProjectEdit?: (project: Project) => void;
}

export default function BedroqGrid({ 
  projects = mockProjects,
  onCreateProject,
  onProjectClick,
  onProjectEdit,
}: BedroqGridProps) {
  const theme = useTheme();
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(6);
  const navigate = useNavigate();

  // Calculate pagination
  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedProjects = projects.slice(startIndex, endIndex);
  const totalPages = Math.ceil(projects.length / rowsPerPage);

  const handlePageChange = (event: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: any) => {
    setRowsPerPage(event.target.value);
    setPage(1); // Reset to first page when changing rows per page
  };

  const handleCreateProject = () => {
    console.log('Creating new project...');
    // onCreateProject?.();
    navigate('/project-setup');
  };

  const handleProjectCardClick = (project: Project, uid: Number) => {
    console.log('Opening project:', project.title);
    onProjectClick?.(project);
    navigate('/projects/' + uid);
  };

  const handleProjectEdit = (event: React.MouseEvent, project: Project) => {
    event.stopPropagation(); // Prevent card click
    console.log('Editing project:', project.title);
    onProjectEdit?.(project);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Projects
      </Typography>

      {/* Create New Project Card */}
      <Card
        sx={{
          mb: 3,
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          border: `2px dashed ${theme.palette.divider}`,
          backgroundColor: 'transparent',
          '&:hover': {
            borderColor: theme.palette.primary.main,
            backgroundColor: theme.palette.action.hover,
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[4],
          },
        }}
        onClick={handleCreateProject}
      >
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 120,
            textAlign: 'center',
          }}
        >
          <AddIcon
            sx={{
              fontSize: 48,
              color: theme.palette.primary.main,
              mb: 1,
            }}
          />
          <Typography variant="h6" color="primary">
            Create New Project
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Start a new project to manage your development workflow
          </Typography>
        </CardContent>
      </Card>

      {/* Project Cards Grid */}
      <Grid container spacing={3}>
        {paginatedProjects.map((project) => (
          <Grid 
            key={project.id} 
            size={{ xs: 12, sm: 6, md: 4, lg: 4, xl: 3 }}
          >
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8],
                },
              }}
              onClick={() => handleProjectCardClick(project, 1)}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                {/* Header with title and status */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                    <ProjectIcon color="primary" />
                    <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                      {project.title}
                    </Typography>
                  </Box>
                  <IconButton 
                    size="small" 
                    onClick={(e) => handleProjectEdit(e, project)}
                    sx={{ ml: 1 }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Status Chip */}
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={getStatusText(project.status)}
                    color={getStatusColor(project.status) as any}
                    size="small"
                    variant="outlined"
                  />
                </Box>

                {/* Description */}
                {project.description && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ mb: 2, lineHeight: 1.4 }}
                  >
                    {project.description}
                  </Typography>
                )}

                {/* Progress bar for active projects */}
                {project.status === 'active' && project.progress && (
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Progress
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {project.progress}%
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: '100%',
                        height: 4,
                        backgroundColor: theme.palette.grey[200],
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          width: `${project.progress}%`,
                          height: '100%',
                          backgroundColor: theme.palette.success.main,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </Box>
                  </Box>
                )}

                <Divider sx={{ my: 1.5 }} />

                {/* Owner and date */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                      <PersonIcon fontSize="small" />
                    </Avatar>
                    <Typography variant="body2" color="text.secondary">
                      {project.owner}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {project.createdDate.toLocaleDateString()}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pagination Controls */}
      {projects.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 4,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          {/* Rows per page selector */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Rows per page</InputLabel>
            <Select
              value={rowsPerPage}
              label="Rows per page"
              onChange={handleRowsPerPageChange}
            >
              <MenuItem value={6}>6</MenuItem>
              <MenuItem value={12}>12</MenuItem>
              <MenuItem value={18}>18</MenuItem>
              <MenuItem value={24}>24</MenuItem>
            </Select>
          </FormControl>

          {/* Pagination info and controls */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {`${startIndex + 1}-${Math.min(endIndex, projects.length)} of ${projects.length} projects`}
            </Typography>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              size="medium"
              showFirstButton
              showLastButton
            />
          </Stack>
        </Box>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 300,
            textAlign: 'center',
          }}
        >
          <ProjectIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No projects found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first project to get started
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateProject}
          >
            Create Project
          </Button>
        </Box>
      )}
    </Box>
  );
}