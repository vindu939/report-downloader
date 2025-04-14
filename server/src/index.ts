import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = 3000;

// Store report generation status and data
interface ReportData {
  status: 'pending' | 'completed' | 'failed';
  name: string;
  createdAt: number;
  filePath?: string;
  error?: string;
}

const reports = new Map<string, ReportData>();

app.use(cors());
app.use(express.json());

// Route to initiate report generation
app.post('/api/generate-report', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Report name is required' });
  }

  const jobId = uuidv4();
  const now = Date.now();
  
  reports.set(jobId, { 
    status: 'pending',
    name,
    createdAt: now
  });
  
  // Simulate async report generation with different delays based on report type
  const delay = name.toLowerCase().includes('sales') ? 8000 : 5000;
  
  setTimeout(() => {
    try {
      // Simulate report generation
      const filePath = `/reports/${name.toLowerCase().replace(/\s+/g, '-')}-${jobId}.csv`;
      
      reports.set(jobId, { 
        status: 'completed',
        name,
        createdAt: now,
        filePath
      });
    } catch (error) {
      reports.set(jobId, { 
        status: 'failed',
        name,
        createdAt: now,
        error: 'Failed to generate report'
      });
    }
  }, delay);

  return res.json({ jobId });
});

// SSE endpoint for status updates
app.get('/api/report-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const report = reports.get(jobId);
  if (!report) {
    res.write(`data: ${JSON.stringify({ error: 'Report not found' })}\n\n`);
    res.end();
    return;
  }

  // Check if report is older than 30 minutes
  const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
  if (report.createdAt < thirtyMinutesAgo) {
    reports.delete(jobId);
    res.write(`data: ${JSON.stringify({ error: 'Report expired' })}\n\n`);
    res.end();
    return;
  }

  const checkStatus = () => {
    const currentReport = reports.get(jobId);
    if (!currentReport) {
      res.write(`data: ${JSON.stringify({ error: 'Report not found' })}\n\n`);
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify(currentReport)}\n\n`);

    if (currentReport.status === 'completed' || currentReport.status === 'failed') {
      res.end();
      return;
    }
    
    setTimeout(checkStatus, 50000);
  };

  checkStatus();
});

// Route to download the generated report
app.get('/api/download-report/:jobId', (req, res) => {
  const { jobId } = req.params;
  const report = reports.get(jobId);

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  if (report.status !== 'completed' || !report.filePath) {
    return res.status(400).json({ error: 'Report is not ready for download' });
  }

  // Check if report is older than 30 minutes
  const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
  if (report.createdAt < thirtyMinutesAgo) {
    reports.delete(jobId);
    return res.status(400).json({ error: 'Report has expired' });
  }

  // In a real application, you would stream the actual file
  // For this example, we'll create a sample CSV file based on the report type
  let csvContent = 'id,name,value\n';
  if (report.name.toLowerCase().includes('sales')) {
    csvContent += '1,Product A,1000\n2,Product B,2000\n3,Product C,3000';
  } else {
    csvContent += '1,Item X,50\n2,Item Y,75\n3,Item Z,100';
  }
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${report.name.toLowerCase().replace(/\s+/g, '-')}.csv`);
  return res.send(csvContent);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 