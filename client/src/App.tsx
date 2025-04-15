import { 
  Box, 
  Button, 
  Container, 
  LinearProgress, 
  Paper, 
  Typography,
} from '@mui/material'
import { DownloadStatus } from './components/DownloadStatus'
import { useReportGeneration } from './hooks/useReportGeneration'

const API_BASE_URL = 'http://localhost:3000/api'

interface ReportData {
  name: string;
}

interface ReportStatus {
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  timestamp?: number;
}

function App() {
  const {
    jobs,
    isStatusOpen,
    showDownloadSection,
    isLoading,
    generateReport,
    handleRemoveJob,
    handleCancelAll,
    setIsStatusOpen
  } = useReportGeneration<ReportData>({
    apiConfig: {
      baseUrl: API_BASE_URL,
      generateEndpoint: '/generate-report',
      statusEndpoint: (jobId) => `/report-status/${jobId}`,
      downloadEndpoint: (jobId) => `/download-report/${jobId}`
    },
    responseHandlers: {
      parseGenerateResponse: (response) => ({ jobId: response.jobId }),
      parseStatusResponse: (response) => response as ReportStatus,
      getJobName: (jobData) => jobData.name
    },
    onJobAdded: (job) => {
      console.log('New job added:', job)
    },
    onJobCompleted: (job) => {
      console.log('Job completed:', job)
    },
    onJobFailed: (job) => {
      console.log('Job failed:', job)
    }
  })

  return (
    <Container maxWidth="md">
      <Box sx={{ minHeight: '100vh', py: 4 }}>
        <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Report Generator
          </Typography>

          <Button
            variant="contained"
            onClick={() => generateReport({ name: 'Sales Report' })}
            disabled={isLoading}
            sx={{ mb: 3, mr: 2 }}
          >
            Generate Sales Report
          </Button>

          <Button
            variant="contained"
            onClick={() => generateReport({ name: 'Inventory Report' })}
            disabled={isLoading}
            sx={{ mb: 3 }}
          >
            Generate Inventory Report
          </Button>

          {isLoading && (
            <Box sx={{ width: '100%', mb: 2 }}>
              <LinearProgress />
            </Box>
          )}
        </Paper>

        {showDownloadSection && (
          <DownloadStatus
            jobs={jobs}
            isOpen={isStatusOpen}
            onToggle={() => setIsStatusOpen(!isStatusOpen)}
            onRemoveJob={handleRemoveJob}
            onCancelAll={handleCancelAll}
          />
        )}
      </Box>
    </Container>
  )
}

export default App
