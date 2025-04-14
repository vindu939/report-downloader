import { 
  Box, 
  Paper, 
  Typography,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Badge,
  Tooltip,
  Button,
  LinearProgress
} from '@mui/material'
import { 
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
  Download as DownloadIcon
} from '@mui/icons-material'

interface ReportStatus {
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  timestamp?: number;
}

interface ReportJob {
  id: string;
  status: ReportStatus;
  name: string;
  createdAt: number;
  downloaded?: boolean;
}

interface DownloadStatusProps {
  jobs: ReportJob[];
  isOpen: boolean;
  onToggle: () => void;
  onRemoveJob: (jobId: string) => void;
  onCancelAll: () => void;
}

export function DownloadStatus({ 
  jobs, 
  isOpen, 
  onToggle, 
  onRemoveJob, 
  onCancelAll 
}: DownloadStatusProps) {
  const pendingJobs = jobs.filter(job => job.status.status === 'pending')

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        right: 0, 
        width: 300,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        overflow: 'hidden'
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 1,
          bgcolor: 'primary.main',
          color: 'white'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <DownloadIcon sx={{ mr: 1 }} />
          <Typography variant="subtitle1">
            Downloads ({pendingJobs.length})
          </Typography>
          <Badge 
            badgeContent={pendingJobs.length} 
            color="error"
            sx={{ ml: 1 }}
          />
        </Box>
        <IconButton 
          size="small" 
          onClick={onToggle}
          sx={{ color: 'white' }}
        >
          {isOpen ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </Box>

      <Collapse in={isOpen}>
        <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
          {jobs.map((job) => (
            <ListItem 
              key={job.id}
              sx={{ 
                borderBottom: '1px solid rgba(0,0,0,0.12)',
                '&:last-child': { borderBottom: 'none' }
              }}
            >
              <ListItemIcon>
                {job.status.status === 'completed' ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <LinearProgress sx={{ width: 20 }} />
                )}
              </ListItemIcon>
              <ListItemText 
                primary={job.name}
                secondary={job.status.status}
              />
              {job.status.status === 'pending' && (
                <ListItemSecondaryAction>
                  <Tooltip title="Cancel">
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={() => onRemoveJob(job.id)}
                    >
                      <CancelIcon />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          ))}
        </List>
        {pendingJobs.length > 0 && (
          <Box sx={{ p: 1, borderTop: '1px solid rgba(0,0,0,0.12)' }}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<CloseIcon />}
              onClick={onCancelAll}
            >
              Cancel All
            </Button>
          </Box>
        )}
      </Collapse>
    </Paper>
  )
} 