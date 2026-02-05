 import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
 import { Download, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ExportAllButtonProps {
  bookId: string;
  bookTitle: string;
}

 type ExportStatus = 'idle' | 'exporting' | 'complete' | 'error';
 
const ExportAllButton = ({ bookId, bookTitle }: ExportAllButtonProps) => {
   const [status, setStatus] = useState<ExportStatus>('idle');
   const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
   const [pageCount, setPageCount] = useState(0);
 

   // Reset state when book changes
   useEffect(() => {
     setStatus('idle');
     setDownloadUrl(null);
     setPageCount(0);
 
   }, [bookId]);

   const handleExportAll = async () => {
     setStatus('exporting');
     setDownloadUrl(null);
 
    try {
       toast({
         title: 'Creating ZIP archive',
         description: 'Building your download in the background. This may take a moment for large books...',
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

       setDownloadUrl(data.downloadUrl);
       setPageCount(data.pageCount);
       setStatus('complete');
 
      toast({
        title: 'Export complete!',
         description: `${data.pageCount} images ready for download.`,
      });
    } catch (error) {
      console.error('Export error:', error);
       setStatus('error');
 
      toast({
        title: 'Export failed',
         description: error instanceof Error ? error.message : 'There was an error exporting images. Please try again.',
        variant: 'destructive',
      });
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
    <Button
      variant="outline"
      onClick={handleExportAll}
       disabled={status === 'exporting'}
      className="gap-2"
    >
       {status === 'exporting' ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
           Building ZIP...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Export All
        </>
      )}
    </Button>
  );
};

export default ExportAllButton;
