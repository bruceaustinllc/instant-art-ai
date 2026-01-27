import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import JSZip from 'jszip';

interface ExportAllButtonProps {
  bookId: string;
  bookTitle: string;
}

const ExportAllButton = ({ bookId, bookTitle }: ExportAllButtonProps) => {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

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
        title: 'Preparing ZIP file',
        description: `Processing ${total} images. This may take a moment...`,
      });

      // Create a ZIP file with folder named after book
      const zip = new JSZip();
      const safeTitle = bookTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
      const folder = zip.folder(safeTitle);

      if (!folder) throw new Error('Failed to create folder in ZIP');

      // Fetch all pages in batches
      const BATCH_SIZE = 10;
      let processed = 0;

      for (let offset = 0; offset < total; offset += BATCH_SIZE) {
        const { data, error } = await supabase
          .from('book_pages')
          .select('id, page_number, image_url')
          .eq('book_id', bookId)
          .order('page_number', { ascending: true })
          .range(offset, offset + BATCH_SIZE - 1);

        if (error) throw error;

        for (const page of data || []) {
          // Extract base64 data and add to ZIP
          const base64Match = page.image_url.match(/^data:image\/(\w+);base64,(.+)$/);
          if (base64Match) {
            const [, , base64Data] = base64Match;
            const shortId = page.id.split('-')[0];
            const filename = `${String(processed + 1).padStart(4, '0')}_${shortId}.png`;
            folder.file(filename, base64Data, { base64: true });
          }
          processed++;
          setProgress({ current: processed, total });
        }
      }

      // Generate and download the ZIP
      toast({
        title: 'Creating ZIP file',
        description: 'Compressing images...',
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeTitle}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export complete!',
        description: `Downloaded ${processed} images in "${safeTitle}.zip"`,
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
          {progress.total > 0 ? `${progress.current}/${progress.total}` : 'Preparing...'}
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
