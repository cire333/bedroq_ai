import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkIcon from '@mui/icons-material/Link';
import CodeIcon from '@mui/icons-material/Code';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { areaElementClasses } from '@mui/x-charts/LineChart';

export type CardMode = 'github-connect' | 'firmware-link' | 'project-stats';

export type StatCardProps = {
  mode: CardMode;
  title: string;
  value?: string;
  interval?: string;
  trend?: 'up' | 'down' | 'neutral';
  data?: number[];
  // GitHub connect props
  onGitHubConnect?: () => void;
  // Firmware link props
  onFirmwareLink?: () => void;
  firmwareProjects?: Array<{ id: string; name: string; version: string }>;
  // Project stats props
  projectName?: string;
  repository?: string;
  lastCommit?: string;
  contributors?: number;
  onViewRepository?: () => void;
};

function getDaysInMonth(month: number, year: number) {
  const date = new Date(year, month, 0);
  const monthName = date.toLocaleDateString('en-US', {
    month: 'short',
  });
  const daysInMonth = date.getDate();
  const days = [];
  let i = 1;
  while (days.length < daysInMonth) {
    days.push(`${monthName} ${i}`);
    i += 1;
  }
  return days;
}

function AreaGradient({ color, id }: { color: string; id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor={color} stopOpacity={0.3} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

function GitHubConnectCard({ title, onGitHubConnect }: { title: string; onGitHubConnect?: () => void }) {
  return (
    <Card variant="outlined" sx={{ height: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <GitHubIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography component="h2" variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Connect your GitHub account to link firmware projects and track development progress
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button
          variant="contained"
          startIcon={<GitHubIcon />}
          onClick={onGitHubConnect}
          sx={{ minWidth: 140 }}
        >
          Connect GitHub
        </Button>
      </CardActions>
    </Card>
  );
}

function FirmwareLinkCard({ 
  title, 
  onFirmwareLink, 
  firmwareProjects = [] 
}: { 
  title: string; 
  onFirmwareLink?: () => void;
  firmwareProjects?: Array<{ id: string; name: string; version: string }>;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography component="h2" variant="subtitle2" gutterBottom>
          {title}
        </Typography>
        
        {firmwareProjects.length > 0 ? (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {firmwareProjects.map((project) => (
              <Box 
                key={project.id}
                sx={{ 
                  p: 1.5, 
                  border: 1, 
                  borderColor: 'divider', 
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack>
                    <Typography variant="body2" fontWeight="medium">
                      {project.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Version {project.version}
                    </Typography>
                  </Stack>
                  <Chip size="small" label="Linked" color="success" />
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CodeIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No firmware projects linked yet
            </Typography>
          </Box>
        )}
      </CardContent>
      
      <CardActions>
        <Button
          variant="outlined"
          startIcon={<LinkIcon />}
          onClick={onFirmwareLink}
          fullWidth
        >
          Link Firmware Project
        </Button>
      </CardActions>
    </Card>
  );
}

function ProjectStatsCard({
  title,
  value,
  interval,
  trend,
  data,
  projectName,
  repository,
  lastCommit,
  contributors,
  onViewRepository
}: StatCardProps) {
  const theme = useTheme();
  const daysInWeek = getDaysInMonth(4, 2024);

  const trendColors = {
    up: theme.palette.mode === 'light'
      ? theme.palette.success.main
      : theme.palette.success.dark,
    down: theme.palette.mode === 'light'
      ? theme.palette.error.main
      : theme.palette.error.dark,
    neutral: theme.palette.mode === 'light'
      ? theme.palette.grey[400]
      : theme.palette.grey[700],
  };

  const labelColors = {
    up: 'success' as const,
    down: 'error' as const,
    neutral: 'default' as const,
  };

  const color = labelColors[trend || 'neutral'];
  const chartColor = trendColors[trend || 'neutral'];
  const trendValues = { up: '+25%', down: '-25%', neutral: '+5%' };

  return (
    <Card variant="outlined" sx={{ height: '100%', flexGrow: 1 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
          <Typography component="h2" variant="subtitle2" gutterBottom>
            {title}
          </Typography>
          {onViewRepository && (
            <IconButton size="small" onClick={onViewRepository}>
              <GitHubIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>

        {projectName && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            {projectName}
          </Typography>
        )}

        <Stack
          direction="column"
          sx={{ justifyContent: 'space-between', flexGrow: '1', gap: 1 }}
        >
          <Stack sx={{ justifyContent: 'space-between' }}>
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Typography variant="h4" component="p">
                {value}
              </Typography>
              {trend && <Chip size="small" color={color} label={trendValues[trend]} />}
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {interval}
            </Typography>
          </Stack>

          {/* Additional project info */}
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            {contributors && (
              <Typography variant="caption" color="text.secondary">
                {contributors} contributors
              </Typography>
            )}
            {lastCommit && (
              <Typography variant="caption" color="text.secondary">
                Last commit: {lastCommit}
              </Typography>
            )}
          </Stack>

          {data && data.length > 0 && (
            <Box sx={{ width: '100%', height: 50 }}>
              <SparkLineChart
                data={data}
                area
                showHighlight
                showTooltip
                xAxis={{
                  scaleType: 'band',
                  data: daysInWeek,
                }}
                sx={{
                  [`& .${areaElementClasses.root}`]: {
                    fill: `url(#area-gradient-${value})`,
                  },
                }}
              >
                <AreaGradient color={chartColor} id={`area-gradient-${value}`} />
              </SparkLineChart>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function StatCard(props: StatCardProps) {
  const { mode } = props;

  switch (mode) {
    case 'github-connect':
      return <GitHubConnectCard title={props.title} onGitHubConnect={props.onGitHubConnect} />;
    
    case 'firmware-link':
      return (
        <FirmwareLinkCard
          title={props.title}
          onFirmwareLink={props.onFirmwareLink}
          firmwareProjects={props.firmwareProjects}
        />
      );
    
    case 'project-stats':
      return <ProjectStatsCard {...props} />;
    
    default:
      return <ProjectStatsCard {...props} />;
  }
}