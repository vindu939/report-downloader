import { useState, useEffect, useRef } from 'react'
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
  const eventSourcesRef = useRef<{ [key: string]: EventSource }>({})

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

  // Effect to handle SSE connections for new pending jobs
  useEffect(() => {
    const newPendingJobs = jobs.filter(
      job => job.status.status === 'pending' && !eventSourcesRef.current[job.id]
    )

    newPendingJobs.forEach(job => {
      const eventSource = new EventSource(`${apiConfig.baseUrl}${apiConfig.statusEndpoint(job.id)}`)
      eventSourcesRef.current[job.id] = eventSource

      eventSource.onmessage = (event) => {
        const data = responseHandlers.parseStatusResponse(JSON.parse(event.data))
        setJobs(prev => prev.map(j => {
          if (j.id === job.id) {
            const updatedJob: ReportJob = { 
              ...j, 
              status: { ...data, timestamp: Date.now() } 
            }
            
            if (data.status === 'completed' && !j.downloaded) {
              window.location.href = `${apiConfig.baseUrl}${apiConfig.downloadEndpoint(job.id)}`
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
          delete eventSourcesRef.current[job.id]
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
        delete eventSourcesRef.current[job.id]
      }
    })

    return () => {
      // Cleanup will be handled by the individual event sources when they complete or fail
    }
  }, [jobs.length, apiConfig, responseHandlers, onJobCompleted, onJobFailed])

  const handleRemoveJob = (jobId: string) => {
    setJobs(prev => {
      const updatedJobs = prev.filter(job => job.id !== jobId)
      if (updatedJobs.length === 0) {
        setShowDownloadSection(false)
      }
      return updatedJobs
    })
    // Close the event source if it exists
    if (eventSourcesRef.current[jobId]) {
      eventSourcesRef.current[jobId].close()
      delete eventSourcesRef.current[jobId]
    }
  }

  const handleCancelAll = () => {
    setJobs(prev => {
      const completedJobs = prev.filter(job => job.status.status === 'completed')
      setShowDownloadSection(false)
      return completedJobs
    })
    // Close all event sources
    Object.values(eventSourcesRef.current).forEach(es => es.close())
    eventSourcesRef.current = {}
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