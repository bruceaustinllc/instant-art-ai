 import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
 import { Download, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
 import { Progress } from '@/components/ui/progress';

interface ExportAllButtonProps {
  bookId: string;
  bookTitle: string;
}

 type ExportStatus = 'idle' | 'exporting' | 'complete' | 'error';
 
const ExportAllButton = ({ bookId, bookTitle }: ExportAllButtonProps) => {
   const [status, setStatus] = useState<ExportStatus>('idle');
   const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
   const [pageCount, setPageCount] = useState(0);
   const [progress, setProgress] = useState({ current: 0, total: 0 });
   const [jobId, setJobId] = useState<string | null>(null);
   const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
   const actionInProgressRef = useRef(false);

   // Reset state when book changes
   useEffect(() => {
     setStatus('idle');
     setDownloadUrl(null);
     setPageCount(0);
     setProgress({ current: 0, total: 0 });
     setJobId(null);
     if (pollIntervalRef.current) {
       clearInterval(pollIntervalRef.current);
       pollIntervalRef.current = null;
     }
   }, [bookId]);
 
   // Cleanup on unmount
   useEffect(() => {
     return () => {
       if (pollIntervalRef.current) {
         clearInterval(pollIntervalRef.current);
       }
     };
   }, []);
 
   // Poll for job status
   useEffect(() => {
     if (!jobId || status !== 'exporting') return;
 
     const pollStatus = async () => {
       const { data, error } = await supabase
         .from('export_jobs')
         .select('status, processed_pages, total_pages, download_url, error_message')
         .eq('id', jobId)
         .single();
 
       if (error) {
         console.error('Poll error:', error);
         return;
       }
 
       if (data) {
         setProgress({ current: data.processed_pages, total: data.total_pages });
 
         if (data.status === 'completed' && data.download_url) {
           setStatus('complete');
           setDownloadUrl(data.download_url);
           setPageCount(data.total_pages);
           if (pollIntervalRef.current) {
             clearInterval(pollIntervalRef.current);
             pollIntervalRef.current = null;
           }
           toast({
             title: 'Export complete!',
             description: `${data.total_pages} images ready for download.`,
           });
         } else if (data.status === 'failed') {
           setStatus('error');
           if (pollIntervalRef.current) {
             clearInterval(pollIntervalRef.current);
             pollIntervalRef.current = null;
           }
           toast({
             title: 'Export failed',
             description: data.error_message || 'There was an error exporting images.',
             variant: 'destructive',
           });
         }
       }
     };
 
     // Poll immediately, then every 2 seconds
     pollStatus();
     pollIntervalRef.current = setInterval(pollStatus, 2000);
 
     return () => {
       if (pollIntervalRef.current) {
         clearInterval(pollIntervalRef.current);
         pollIntervalRef.current = null;
       }
     };
   }, [jobId, status]);

   const handleExportAll = async () => {
     // Prevent rapid double-clicks
     if (actionInProgressRef.current || status === 'exporting') {
       return;
     }
     actionInProgressRef.current = true;
 
     try {
       // Check for existing pending/processing job for this book
       const { data: existingJob } = await supabase
         .from('export_jobs')
         .select('id, status, processed_pages, total_pages')
         .eq('book_id', bookId)
         .in('status', ['pending', 'processing'])
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle();
 
       if (existingJob) {
         // Resume tracking existing job instead of creating new one
         setJobId(existingJob.id);
         setProgress({ current: existingJob.processed_pages, total: existingJob.total_pages });
         setStatus('exporting');

         // Kick the backend to resume in case the job chain stalled
         const { error: resumeError } = await supabase.functions.invoke('export-book-zip', {
           body: { jobId: existingJob.id },
         });
         if (resumeError) {
           console.warn('Resume export error:', resumeError);
         }

         toast({
           title: 'Export already in progress',
           description: `Resuming tracking: ${existingJob.processed_pages}/${existingJob.total_pages} pages processed.`,
         });
         return;
       }
 
       setStatus('exporting');
       setDownloadUrl(null);
       setProgress({ current: 0, total: 0 });
 
       toast({
         title: 'Creating ZIP archive',
         description: 'Starting background export. You can continue working while it processes...',
       });
 
       const { data, error } = await supabase.functions.invoke('export-book-zip', {
         body: { bookId, bookTitle },
       });
 
       if (error) {
         throw error;
       }
 
       if (data?.error) {
         throw new Error(data.error);
       }
 
       // Job started, begin polling
       if (data?.jobId) {
         setJobId(data.jobId);
         setProgress({ current: 0, total: data.totalPages || 0 });
       }
     } catch (error: unknown) {
       console.error('Export error:', error);
       setStatus('error');
 
       toast({
         title: 'Export failed',
         description: error instanceof Error ? error.message : 'There was an error exporting images. Please try again.',
         variant: 'destructive',
       });
     } finally {
       actionInProgressRef.current = false;
     }
   };

   const handleDownload = () => {
     if (downloadUrl) {
       window.open(downloadUrl, '_blank');
     }
   };
 
   const handleReset = () => {
     setStatus('idle');
     setDownloadUrl(null);
     setPageCount(0);
     setProgress({ current: 0, total: 0 });
     setJobId(null);
     if (pollIntervalRef.current) {
       clearInterval(pollIntervalRef.current);
       pollIntervalRef.current = null;
     }
   };
 
   if (status === 'complete' && downloadUrl) {
     return (
       <div className="flex items-center gap-2">
         <Button
           variant="default"
           onClick={handleDownload}
           className="gap-2"
         >
           <CheckCircle className="h-4 w-4" />
           Download ZIP ({pageCount})
           <ExternalLink className="h-3 w-3" />
         </Button>
         <Button
           variant="ghost"
           size="sm"
           onClick={handleReset}
         >
           Reset
         </Button>
       </div>
     );
   }
 
   if (status === 'error') {
     return (
       <div className="flex items-center gap-2">
         <Button
           variant="destructive"
           onClick={handleExportAll}
           className="gap-2"
         >
           <Download className="h-4 w-4" />
           Retry Export
         </Button>
       </div>
     );
   }
 
  return (
     <div className="flex items-center gap-2">
       <Button
         variant="outline"
         onClick={handleExportAll}
         disabled={status === 'exporting'}
         className="gap-2"
       >
         {status === 'exporting' ? (
           <>
             <Loader2 className="h-4 w-4 animate-spin" />
             {progress.total > 0 
               ? `${progress.current}/${progress.total}`
               : 'Starting...'}
           </>
         ) : (
           <>
             <Download className="h-4 w-4" />
             Export All
           </>
         )}
       </Button>
       {status === 'exporting' && progress.total > 0 && (
         <div className="w-24">
           <Progress 
             value={(progress.current / progress.total) * 100} 
             className="h-2"
           />
         </div>
       )}
     </div>
  );
};

export default ExportAllButton;
