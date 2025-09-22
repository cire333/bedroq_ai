import React, { useState } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Typography,
  Card,
  CardContent,
  TextField,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  Stack,
  Divider,
  Alert,
  LinearProgress,
  IconButton,
  Avatar,
  Switch,
  FormGroup,
} from '@mui/material';
import {
  Upload as UploadIcon,
  CloudUpload as CloudUploadIcon,
  GitHub as GitHubIcon,
  Memory as AIIcon,
  Public as GlobalIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  Folder as FolderIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

// Types
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

interface GitConnection {
  provider: 'github' | 'gitlab';
  repository: string;
  branch: string;
  accessToken?: string;
}

interface AIModel {
  id: string;
  name: string;
  type: 'root' | 'trimmed';
  file: File;
  description?: string;
}

interface ProjectSetupData {
  // Step 1: PCB Files
  pcbFiles: UploadedFile[];
  
  // Step 2: Git Connection
  gitConnection: GitConnection | null;
  
  // Step 3: AI Models
  aiModels: AIModel[];
  
  // Step 4: Project Type & Owner
  projectType: 'global' | 'standalone';
  owner: string;
  
  // Step 5: Description & Documents
  title: string;
  description: string;
  additionalDocuments: UploadedFile[];
}

const steps = [
  {
    label: 'Upload PCB Files',
    description: 'Upload schematics and layout files',
    icon: <UploadIcon />,
  },
  {
    label: 'Connect Repository',
    description: 'Link to GitHub or GitLab',
    icon: <GitHubIcon />,
  },
  {
    label: 'AI Models',
    description: 'Upload AI models for the project',
    icon: <AIIcon />,
  },
  {
    label: 'Project Configuration',
    description: 'Set project type and owner',
    icon: <GlobalIcon />,
  },
  {
    label: 'Details & Documents',
    description: 'Add description and additional files',
    icon: <DescriptionIcon />,
  },
];

export default function ProjectSetupContainer() {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [projectData, setProjectData] = useState<ProjectSetupData>({
    pcbFiles: [],
    gitConnection: null,
    aiModels: [],
    projectType: 'standalone',
    owner: '',
    title: '',
    description: '',
    additionalDocuments: [],
  });

  const [uploading, setUploading] = useState(false);

  // File upload handlers
  const handleFileUpload = (files: FileList | null, category: 'pcb' | 'ai' | 'documents') => {
    if (!files) return;

    const newFiles: UploadedFile[] = Array.from(files).map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    }));

    setProjectData(prev => {
      switch (category) {
        case 'pcb':
          return { ...prev, pcbFiles: [...prev.pcbFiles, ...newFiles] };
        case 'documents':
          return { ...prev, additionalDocuments: [...prev.additionalDocuments, ...newFiles] };
        default:
          return prev;
      }
    });
  };

  const handleAIModelUpload = (files: FileList | null, modelType: 'root' | 'trimmed') => {
    if (!files) return;

    const newModels: AIModel[] = Array.from(files).map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: modelType,
      file,
      description: '',
    }));

    setProjectData(prev => ({
      ...prev,
      aiModels: [...prev.aiModels, ...newModels],
    }));
  };

  const removeFile = (id: string, category: 'pcb' | 'ai' | 'documents') => {
    setProjectData(prev => {
      switch (category) {
        case 'pcb':
          return { ...prev, pcbFiles: prev.pcbFiles.filter(f => f.id !== id) };
        case 'ai':
          return { ...prev, aiModels: prev.aiModels.filter(m => m.id !== id) };
        case 'documents':
          return { ...prev, additionalDocuments: prev.additionalDocuments.filter(f => f.id !== id) };
        default:
          return prev;
      }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleFinish = async () => {
    setUploading(true);
    try {
      // Simulate project creation
      console.log('Creating project with data:', projectData);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Here you would make the actual API call to create the project
      alert('Project created successfully!');
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setUploading(false);
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return projectData.pcbFiles.length > 0;
      case 1:
        return projectData.gitConnection !== null;
      case 2:
        return projectData.aiModels.length > 0;
      case 3:
        return projectData.owner.trim() !== '';
      case 4:
        return projectData.title.trim() !== '' && projectData.description.trim() !== '';
      default:
        return false;
    }
  };

  // Step Components
  const renderPCBUploadStep = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Upload PCB Files
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload your schematic and layout files. You can upload individual files or a ZIP archive.
        </Typography>

        <Box
          sx={{
            border: `2px dashed ${theme.palette.divider}`,
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            mb: 3,
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: theme.palette.primary.main,
              backgroundColor: theme.palette.action.hover,
            },
          }}
          onClick={() => document.getElementById('pcb-upload')?.click()}
        >
          <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drop files here or click to upload
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Supported formats: .sch, .kicad_sch, .brd, .kicad_pcb, .zip
          </Typography>
          <input
            id="pcb-upload"
            type="file"
            multiple
            accept=".sch,.kicad_sch,.brd,.kicad_pcb,.zip"
            style={{ display: 'none' }}
            onChange={(e) => handleFileUpload(e.target.files, 'pcb')}
          />
        </Box>

        {projectData.pcbFiles.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Uploaded Files ({projectData.pcbFiles.length})
            </Typography>
            <Stack spacing={1}>
              {projectData.pcbFiles.map((file) => (
                <Chip
                  key={file.id}
                  label={`${file.name} (${formatFileSize(file.size)})`}
                  onDelete={() => removeFile(file.id, 'pcb')}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const renderGitConnectionStep = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Connect Repository
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Link your project to a Git repository for version control.
        </Typography>

        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <FormLabel component="legend">Git Provider</FormLabel>
          <RadioGroup
            value={projectData.gitConnection?.provider || ''}
            onChange={(e) => {
              const provider = e.target.value as 'github' | 'gitlab';
              setProjectData(prev => ({
                ...prev,
                gitConnection: { provider, repository: '', branch: 'main' },
              }));
            }}
          >
            <FormControlLabel
              value="github"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GitHubIcon />
                  GitHub
                </Box>
              }
            />
            <FormControlLabel
              value="gitlab"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderIcon />
                  GitLab
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>

        {projectData.gitConnection && (
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Repository URL"
              placeholder="https://github.com/username/repository"
              value={projectData.gitConnection.repository}
              onChange={(e) => {
                setProjectData(prev => ({
                  ...prev,
                  gitConnection: prev.gitConnection ? {
                    ...prev.gitConnection,
                    repository: e.target.value,
                  } : null,
                }));
              }}
            />
            <TextField
              fullWidth
              label="Default Branch"
              value={projectData.gitConnection.branch}
              onChange={(e) => {
                setProjectData(prev => ({
                  ...prev,
                  gitConnection: prev.gitConnection ? {
                    ...prev.gitConnection,
                    branch: e.target.value,
                  } : null,
                }));
              }}
            />
            <TextField
              fullWidth
              label="Access Token (Optional)"
              type="password"
              placeholder="For private repositories"
              onChange={(e) => {
                setProjectData(prev => ({
                  ...prev,
                  gitConnection: prev.gitConnection ? {
                    ...prev.gitConnection,
                    accessToken: e.target.value,
                  } : null,
                }));
              }}
            />
          </Stack>
        )}
      </CardContent>
    </Card>
  );

  const renderAIModelsStep = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          AI Models
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload AI models for your project. You can upload a root model and trimmed versions.
        </Typography>

        <Stack spacing={3}>
          {/* Root Model Upload */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Root AI Model
            </Typography>
            <Box
              sx={{
                border: `2px dashed ${theme.palette.divider}`,
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
              onClick={() => document.getElementById('ai-root-upload')?.click()}
            >
              <AIIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2">
                Upload root AI model files
              </Typography>
              <input
                id="ai-root-upload"
                type="file"
                multiple
                accept=".py,.pkl,.h5,.onnx,.pt,.pth"
                style={{ display: 'none' }}
                onChange={(e) => handleAIModelUpload(e.target.files, 'root')}
              />
            </Box>
          </Box>

          {/* Trimmed Models Upload */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Trimmed AI Models
            </Typography>
            <Box
              sx={{
                border: `2px dashed ${theme.palette.divider}`,
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: theme.palette.secondary.main,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
              onClick={() => document.getElementById('ai-trimmed-upload')?.click()}
            >
              <AIIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2">
                Upload trimmed/optimized model versions
              </Typography>
              <input
                id="ai-trimmed-upload"
                type="file"
                multiple
                accept=".py,.pkl,.h5,.onnx,.pt,.pth"
                style={{ display: 'none' }}
                onChange={(e) => handleAIModelUpload(e.target.files, 'trimmed')}
              />
            </Box>
          </Box>

          {/* Uploaded Models List */}
          {projectData.aiModels.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Uploaded AI Models ({projectData.aiModels.length})
              </Typography>
              <Stack spacing={1}>
                {projectData.aiModels.map((model) => (
                  <Box
                    key={model.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip
                        label={model.type}
                        size="small"
                        color={model.type === 'root' ? 'primary' : 'secondary'}
                      />
                      <Typography variant="body2">{model.name}</Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => removeFile(model.id, 'ai')}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );

  const renderProjectConfigStep = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Project Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure project type and assign an owner.
        </Typography>

        <Stack spacing={3}>
          {/* Project Type */}
          <FormControl component="fieldset">
            <FormLabel component="legend">Project Type</FormLabel>
            <RadioGroup
              value={projectData.projectType}
              onChange={(e) => {
                setProjectData(prev => ({
                  ...prev,
                  projectType: e.target.value as 'global' | 'standalone',
                }));
              }}
            >
              <FormControlLabel
                value="global"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">Global Project</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Shared across the organization with multiple contributors
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="standalone"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">Standalone Project</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Independent project with limited access
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          {/* Project Owner */}
          <TextField
            fullWidth
            label="Project Owner"
            placeholder="Enter owner name or email"
            value={projectData.owner}
            onChange={(e) => {
              setProjectData(prev => ({ ...prev, owner: e.target.value }));
            }}
            InputProps={{
              startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />

          {/* Project Title */}
          <TextField
            fullWidth
            label="Project Title"
            placeholder="Enter project title"
            value={projectData.title}
            onChange={(e) => {
              setProjectData(prev => ({ ...prev, title: e.target.value }));
            }}
          />
        </Stack>
      </CardContent>
    </Card>
  );

  const renderDetailsStep = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Project Details & Documents
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Add a description and upload additional project documents like PRDs.
        </Typography>

        <Stack spacing={3}>
          {/* Description */}
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Project Description"
            placeholder="Describe your project, its goals, and key features..."
            value={projectData.description}
            onChange={(e) => {
              setProjectData(prev => ({ ...prev, description: e.target.value }));
            }}
          />

          {/* Additional Documents */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Additional Documents
            </Typography>
            <Box
              sx={{
                border: `2px dashed ${theme.palette.divider}`,
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
              onClick={() => document.getElementById('docs-upload')?.click()}
            >
              <DescriptionIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2">
                Upload PRDs, specifications, and other documents
              </Typography>
              <input
                id="docs-upload"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files, 'documents')}
              />
            </Box>

            {projectData.additionalDocuments.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Uploaded Documents ({projectData.additionalDocuments.length})
                </Typography>
                <Stack spacing={1}>
                  {projectData.additionalDocuments.map((file) => (
                    <Chip
                      key={file.id}
                      label={`${file.name} (${formatFileSize(file.size)})`}
                      onDelete={() => removeFile(file.id, 'documents')}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1200px' }, mx: 'auto', p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Create New Project
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Follow the steps below to set up your new project with all necessary files and configurations.
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel
              optional={
                index === steps.length - 1 ? (
                  <Typography variant="caption">Last step</Typography>
                ) : null
              }
              icon={step.icon}
            >
              <Typography variant="h6">{step.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                {step.description}
              </Typography>
            </StepLabel>
            <StepContent>
              <Box sx={{ mb: 2 }}>
                {index === 0 && renderPCBUploadStep()}
                {index === 1 && renderGitConnectionStep()}
                {index === 2 && renderAIModelsStep()}
                {index === 3 && renderProjectConfigStep()}
                {index === 4 && renderDetailsStep()}
              </Box>
              <Box sx={{ mb: 2 }}>
                <div>
                  {index === steps.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleFinish}
                      disabled={!isStepValid(index) || uploading}
                      startIcon={uploading ? <LinearProgress /> : <CheckCircleIcon />}
                    >
                      {uploading ? 'Creating Project...' : 'Create Project'}
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      disabled={!isStepValid(index)}
                    >
                      Continue
                    </Button>
                  )}
                  <Button disabled={index === 0} onClick={handleBack} sx={{ ml: 1 }}>
                    Back
                  </Button>
                </div>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {activeStep === steps.length && (
        <Card sx={{ mt: 3, p: 3, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Project Created Successfully!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your project has been set up with all the specified configurations and files.
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }}>
            Go to Project
          </Button>
        </Card>
      )}
    </Box>
  );
}