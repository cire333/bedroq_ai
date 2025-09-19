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
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';
import {
  CloudUpload as IngestIcon,
  RateReview as ReviewIcon,
  BugReport as IssueIcon,
  Psychology as AIIcon,
  PlayArrow as StartIcon,
  AutoMode as AutoIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

// Interfaces
interface IngestionStatus {
  status: 'processing' | 'completed' | 'failed' | 'pending';
  progress: number;
  filesProcessed: number;
  totalFiles: number;
  lastUpdated: Date;
}

interface ReviewData {
  id: string;
  type: 'manual' | 'automated';
  status: 'completed' | 'in-progress' | 'failed';
  reviewer: string;
  startDate: Date;
  completedDate?: Date;
  issuesFound: number;
  score?: number;
}

interface Issue {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'design' | 'performance' | 'security' | 'compliance';
  status: 'open' | 'in-progress' | 'resolved';
  assignee?: string;
  createdDate: Date;
}

interface AITuningStatus {
  modelAccuracy: number;
  trainingProgress: number;
  lastTrainingDate: Date;
  isTraining: boolean;
  performanceTrend: 'up' | 'down' | 'stable';
  recommendationsCount: number;
}

// Sample data - replace with your actual data
const mockIngestionStatus: IngestionStatus = {
  status: 'processing',
  progress: 75,
  filesProcessed: 15,
  totalFiles: 20,
  lastUpdated: new Date(),
};

const mockReviews: ReviewData[] = [
  {
    id: '1',
    type: 'automated',
    status: 'completed',
    reviewer: 'AI System',
    startDate: new Date('2024-03-15'),
    completedDate: new Date('2024-03-15'),
    issuesFound: 3,
    score: 85,
  },
  {
    id: '2',
    type: 'manual',
    status: 'completed',
    reviewer: 'John Smith',
    startDate: new Date('2024-03-10'),
    completedDate: new Date('2024-03-12'),
    issuesFound: 2,
    score: 92,
  },
  {
    id: '3',
    type: 'automated',
    status: 'in-progress',
    reviewer: 'AI System',
    startDate: new Date('2024-03-20'),
    issuesFound: 0,
  },
];

const mockIssues: Issue[] = [
  {
    id: '1',
    title: 'Power trace width insufficient for current load',
    severity: 'high',
    category: 'design',
    status: 'open',
    assignee: 'Sarah Johnson',
    createdDate: new Date('2024-03-15'),
  },
  {
    id: '2',
    title: 'Via placement violates manufacturing constraints',
    severity: 'medium',
    category: 'compliance',
    status: 'in-progress',
    assignee: 'Mike Chen',
    createdDate: new Date('2024-03-14'),
  },
  {
    id: '3',
    title: 'Ground plane discontinuity detected',
    severity: 'critical',
    category: 'performance',
    status: 'open',
    createdDate: new Date('2024-03-13'),
  },
];

const mockAITuning: AITuningStatus = {
  modelAccuracy: 87.5,
  trainingProgress: 0, // Not currently training
  lastTrainingDate: new Date('2024-03-18'),
  isTraining: false,
  performanceTrend: 'up',
  recommendationsCount: 12,
};

export default function ProjectGrid() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [currentReview] = useState<ReviewData | null>(
    mockReviews.find(r => r.status === 'in-progress') || null
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return 'success';
      case 'processing':
      case 'in-progress':
        return 'info';
      case 'failed':
      case 'error':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const handleStartManualReview = () => {
    console.log('Starting manual review...');
  };

  const handleStartAutomatedReview = () => {
    console.log('Starting automated review...');
  };

  const handleRetrainAI = () => {
    console.log('Starting AI retraining...');
  };

  const handleReview = () => {
    console.log('Navigating to review details...');
    navigate('/reviews/')
  }

  // Data Ingestion Status Card
  const renderIngestionCard = () => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IngestIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6">Data Ingestion</Typography>
        </Box>
        
        <Chip
          label={mockIngestionStatus.status.toUpperCase()}
          color={getStatusColor(mockIngestionStatus.status) as any}
          size="small"
          sx={{ mb: 2 }}
        />
        
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mockIngestionStatus.progress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={mockIngestionStatus.progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary">
          {mockIngestionStatus.filesProcessed} of {mockIngestionStatus.totalFiles} files processed
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Last updated: {mockIngestionStatus.lastUpdated.toLocaleTimeString()}
        </Typography>
      </CardContent>
    </Card>
  );

  // Review Status Card
  const renderReviewCard = () => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ReviewIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6">Latest Review</Typography>
        </Box>

        {currentReview ? (
          <Box>
            <Chip
              label={`${currentReview.type.toUpperCase()} - ${currentReview.status.toUpperCase()}`}
              color={getStatusColor(currentReview.status) as any}
              size="small"
              sx={{ mb: 2 }}
            />
            
             <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {mockIngestionStatus.progress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={mockIngestionStatus.progress}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Avatar sx={{ width: 24, height: 24, mr: 1 }}>
                {currentReview.type === 'automated' ? (
                  <BotIcon fontSize="small" />
                ) : (
                  <PersonIcon fontSize="small" />
                )}
              </Avatar>
              <Typography variant="body2">{currentReview.reviewer}</Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary">
              Started: {currentReview.startDate.toLocaleDateString()}
            </Typography>
            {currentReview.completedDate && (
              <Typography variant="body2" color="text.secondary">
                Completed: {currentReview.completedDate.toLocaleDateString()}
              </Typography>
            )}

            
            <Button
            variant="outlined"
            size="small"
            startIcon={<StartIcon />}
            onClick={handleReview}
            sx={{ mt: 2 }}
          >
            Review
          </Button>
          </Box>
        ) : (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              No active review
            </Alert>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PersonIcon />}
                onClick={handleStartManualReview}
              >
                Manual Review
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AutoIcon />}
                onClick={handleStartAutomatedReview}
              >
                Auto Review
              </Button>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // Issues Status Card
  const renderIssuesCard = () => {
    const openIssues = mockIssues.filter(issue => issue.status === 'open').length;
    const totalIssues = mockIssues.length;
    
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IssueIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">Issues</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {['critical', 'medium', 'low'].map(severity => {
              const count = mockIssues.filter(i => i.severity === severity).length;
              return count > 0 ? (
                <Chip
                  key={severity}
                  label={`${count} ${severity}`}
                  color={getSeverityColor(severity) as any}
                  size="small"
                />
              ) : null;
            })}
          </Stack>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error.main">
                {openIssues}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Open Issues
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="text.primary">
                {totalIssues}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Known
              </Typography>
            </Box>
          </Box>

          
        </CardContent>
      </Card>
    );
  };

  // AI Tuning Card
  const renderAITuningCard = () => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AIIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6">AI Analysis</Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ position: 'relative', display: 'inline-flex', mr: 2 }}>
            <CircularProgress
              variant="determinate"
              value={mockAITuning.modelAccuracy}
              size={60}
              thickness={4}
            />
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="caption" component="div" color="text.secondary">
                {`${Math.round(mockAITuning.modelAccuracy)}%`}
              </Typography>
            </Box>
          </Box>
          
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ mr: 1 }}>
                Model Accuracy
              </Typography>
              {mockAITuning.performanceTrend === 'up' ? (
                <TrendingUpIcon color="success" fontSize="small" />
              ) : mockAITuning.performanceTrend === 'down' ? (
                <TrendingDownIcon color="error" fontSize="small" />
              ) : null}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {mockAITuning.recommendationsCount} recommendations
            </Typography>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Last trained: {mockAITuning.lastTrainingDate.toLocaleDateString()}
        </Typography>
        
        {!mockAITuning.isTraining && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<StartIcon />}
            onClick={handleRetrainAI}
            sx={{ mt: 2 }}
          >
            Retrain Model
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
      {/* Status Cards */}
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Project Overview
      </Typography>
      <Grid
        container
        spacing={2}
        columns={12}
        sx={{ mb: 4 }}
      >
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          {renderIngestionCard()}
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          {renderReviewCard()}
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          {renderIssuesCard()}
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          {renderAITuningCard()}
        </Grid>
      </Grid>

      {/* Past Reviews Section */}
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Review History
      </Typography>
      <Paper sx={{ mb: 4 }}>
        <List>
          {mockReviews.filter(r => r.status === 'completed').map((review, index) => (
            <React.Fragment key={review.id}>
              <ListItem>
                <ListItemAvatar>
                  <Avatar>
                    {review.type === 'automated' ? (
                      <BotIcon />
                    ) : (
                      <PersonIcon />
                    )}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1">
                        {review.type === 'automated' ? 'Automated Review' : 'Manual Review'}
                      </Typography>
                      <Chip
                        label={`Score: ${review.score}%`}
                        color={review.score && review.score > 80 ? 'success' : 'warning'}
                        size="small"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        By {review.reviewer} • {review.completedDate?.toLocaleDateString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {review.issuesFound} issues found
                      </Typography>
                    </Box>
                  }
                />
                <ListItemIcon>
                  <CheckIcon color="success" />
                </ListItemIcon>
              </ListItem>
              {index < mockReviews.filter(r => r.status === 'completed').length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </Paper>

      {/* Open Issues Section */}
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Open Issues
      </Typography>
      <Paper>
        <List>
          {mockIssues.filter(issue => issue.status === 'open').map((issue, index) => (
            <React.Fragment key={issue.id}>
              <ListItem>
                <ListItemIcon>
                  {issue.severity === 'critical' ? (
                    <ErrorIcon color="error" />
                  ) : issue.severity === 'high' ? (
                    <WarningIcon color="warning" />
                  ) : (
                    <IssueIcon color="info" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1">{issue.title}</Typography>
                      <Chip
                        label={issue.severity.toUpperCase()}
                        color={getSeverityColor(issue.severity) as any}
                        size="small"
                      />
                      <Chip
                        label={issue.category}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Created: {issue.createdDate.toLocaleDateString()}
                      </Typography>
                      {issue.assignee && (
                        <Typography variant="body2" color="text.secondary">
                          Assigned to: {issue.assignee}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
              {index < mockIssues.filter(issue => issue.status === 'open').length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
}