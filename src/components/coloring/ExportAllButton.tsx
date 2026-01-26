import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ExportAllButtonProps {
  bookId: string;
  bookTitle: string;
}

const ExportAllButton = ({ bookId, bookTitle }: ExportAllButtonProps) => {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleExportAll = async () => {
    setExporting(true);
    setProgress({ current: 0, total: 0 });

    try {
      // First get the total count
      const { count, error: countError } = await supabase
        .from('book_pages')
        .select('id', { count: 'exact', head: true })
        .eq('book_id', bookId);

      if (countError) throw countError;

      const total = count ?? 0;
      if (total === 0) {
        toast({
          title: 'No pages to export',
          description: 'This book has no generated pages yet.',
        });
        setExporting(false);
        return;
      }

      setProgress({ current: 0, total });

      toast({
        title: 'Starting export',
        description: `Downloading ${total} images. They will save to your downloads folder.`,
      });

      // Fetch and download in small batches to avoid memory issues
      const BATCH_SIZE = 2;
      let downloaded = 0;

      for (let offset = 0; offset < total; offset += BATCH_SIZE) {
        const { data, error } = await supabase
          .from('book_pages')
          .select('id, page_number, image_url, prompt')
          .eq('book_id', bookId)
          .order('page_number', { ascending: true })
          .range(offset, offset + BATCH_SIZE - 1);

        if (error) throw error;

        for (const page of data || []) {
          // Generate a safe filename
          const safeTitle = bookTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
          const filename = `${safeTitle}_page_${String(page.page_number).padStart(3, '0')}.png`;
          
          downloadImage(page.image_url, filename);
          downloaded++;
          setProgress({ current: downloaded, total });

          // Small delay between downloads to avoid browser blocking
          await delay(300);
        }
      }

      toast({
        title: 'Export complete!',
        description: `Successfully downloaded ${downloaded} images.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'There was an error exporting images. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleExportAll}
      disabled={exporting}
      className="gap-2"
    >
      {exporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Exporting {progress.current}/{progress.total}
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Export All Images
        </>
      )}
    </Button>
  );
};

export default ExportAllButton;
