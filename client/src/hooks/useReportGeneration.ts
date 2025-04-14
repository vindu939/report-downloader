import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'

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

interface UseReportGenerationOptions<T = any> {
  // API Configuration
  apiConfig: {
    baseUrl: string;
    generateEndpoint: string;
    statusEndpoint: (jobId: string) => string;
    downloadEndpoint: (jobId: string) => string;
  };
  // Response handling
  responseHandlers: {
    parseGenerateResponse: (response: any) => { jobId: string };
    parseStatusResponse: (response: any) => ReportStatus;
    getJobName: (jobData: T) => string;
  };
  // Storage configuration
  storageConfig?: {
    key?: string;
    expiryTime?: number;
  };
  // Callbacks
  onJobAdded?: (job: ReportJob) => void;
  onJobCompleted?: (job: ReportJob) => void;
  onJobFailed?: (job: ReportJob) => void;
}

const DEFAULT_STORAGE_CONFIG = {
  key: 'report_jobs',
  expiryTime: 30 * 60 * 1000 // 30 minutes in milliseconds
}

export function useReportGeneration<T = any>(options: UseReportGenerationOptions<T>) {
  const {
    apiConfig,
    responseHandlers,
    storageConfig = DEFAULT_STORAGE_CONFIG,
    onJobAdded,
    onJobCompleted,
    onJobFailed
  } = options

  const storageKey = storageConfig.key ?? DEFAULT_STORAGE_CONFIG.key
  const expiryTime = storageConfig.expiryTime ?? DEFAULT_STORAGE_CONFIG.expiryTime

  const [jobs, setJobs] = useState<ReportJob[]>(() => {
    const storedJobs = localStorage.getItem(storageKey)
    if (storedJobs) {
      const parsedJobs = JSON.parse(storedJobs) as ReportJob[]
      return parsedJobs.filter(job => 
        job.status.status !== 'completed' && 
        Date.now() - job.createdAt < expiryTime
      )
    }
    return []
  })

  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [showDownloadSection, setShowDownloadSection] = useState(false)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(jobs))
  }, [jobs, storageKey])

  const generateReportMutation = useMutation({
    mutationFn: async (jobData: T) => {
      const response = await fetch(`${apiConfig.baseUrl}${apiConfig.generateEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData),
      })
      return response.json()
    },
    onSuccess: (data, jobData) => {
      const { jobId } = responseHandlers.parseGenerateResponse(data)
      const newJob: ReportJob = {
        id: jobId,
        status: { status: 'pending', timestamp: Date.now() },
        name: responseHandlers.getJobName(jobData),
        createdAt: Date.now(),
        downloaded: false
      }
      setJobs(prev => [...prev, newJob])
      setShowDownloadSection(true)
      setIsStatusOpen(true)
      onJobAdded?.(newJob)
    },
  })

  useEffect(() => {
    const eventSources: { [key: string]: EventSource } = {}

    jobs.forEach(job => {
      if (job.status.status === 'pending' && !eventSources[job.id]) {
        const eventSource = new EventSource(apiConfig.statusEndpoint(job.id))
        eventSources[job.id] = eventSource

        eventSource.onmessage = (event) => {
          const data = responseHandlers.parseStatusResponse(JSON.parse(event.data))
          setJobs(prev => prev.map(j => {
            if (j.id === job.id) {
              const updatedJob: ReportJob = { 
                ...j, 
                status: { ...data, timestamp: Date.now() } 
              }
              
              if (data.status === 'completed' && !j.downloaded) {
                window.location.href = apiConfig.downloadEndpoint(job.id)
                const finalJob: ReportJob = { ...updatedJob, downloaded: true }
                onJobCompleted?.(finalJob)
                return finalJob
              }
              
              if (data.status === 'failed') {
                onJobFailed?.(updatedJob)
              }
              
              return updatedJob
            }
            return j
          }))

          if (data.status === 'completed' || data.status === 'failed') {
            eventSource.close()
          }
        }

        eventSource.onerror = () => {
          const failedJob: ReportJob = { 
            ...job, 
            status: { status: 'failed' as const, error: 'Connection error', timestamp: Date.now() } 
          }
          setJobs(prev => prev.map(j => j.id === job.id ? failedJob : j))
          onJobFailed?.(failedJob)
          eventSource.close()
        }
      }
    })

    return () => {
      Object.values(eventSources).forEach(es => es.close())
    }
  }, [jobs, apiConfig, responseHandlers, onJobCompleted, onJobFailed])

  const handleRemoveJob = (jobId: string) => {
    setJobs(prev => {
      const updatedJobs = prev.filter(job => job.id !== jobId)
      if (updatedJobs.length === 0) {
        setShowDownloadSection(false)
      }
      return updatedJobs
    })
  }

  const handleCancelAll = () => {
    setJobs(prev => {
      const completedJobs = prev.filter(job => job.status.status === 'completed')
      setShowDownloadSection(false)
      return completedJobs
    })
  }

  return {
    jobs,
    isStatusOpen,
    showDownloadSection,
    isLoading: generateReportMutation.isPending,
    generateReport: generateReportMutation.mutate,
    handleRemoveJob,
    handleCancelAll,
    setIsStatusOpen,
    setShowDownloadSection
  }
} 