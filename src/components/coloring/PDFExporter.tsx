import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileDown, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ColoringBook, BookPage } from '@/hooks/useColoringBooks';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface PDFExporterProps {
  book: ColoringBook;
  pages: BookPage[];
}

// KDP specifications for 8.5 x 11 inches with bleed
const KDP_SPECS = {
  pageWidth: 8.75, // 8.5 + 0.125 bleed on each side
  pageHeight: 11.25, // 11 + 0.125 bleed on each side
  bleed: 0.125,
  safeMargin: 0.375, // 0.25" margin + 0.125" bleed = 0.375" from edge
  contentWidth: 8.5 - 2 * 0.25, // 8.0 inches
  contentHeight: 11 - 2 * 0.25, // 10.5 inches
};

const PDFExporter = ({ book, pages }: PDFExporterProps) => {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [singleSided, setSingleSided] = useState(false); // New state for single-sided printing
  const { toast } = useToast();

  const exportPDF = async () => {
    if (pages.length === 0) {
      toast({
        title: 'No pages to export',
        description: 'Add some pages to your book first.',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    setProgress(0);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [KDP_SPECS.pageWidth, KDP_SPECS.pageHeight],
      });

      let currentPageIndex = 0;

      // Add Title Page
      pdf.addPage([KDP_SPECS.pageWidth, KDP_SPECS.pageHeight]);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, KDP_SPECS.pageWidth, KDP_SPECS.pageHeight, 'F');
      pdf.setTextColor(0); // Black text for print
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(36);
      pdf.text(book.title, KDP_SPECS.pageWidth / 2, KDP_SPECS.pageHeight / 2 - 1, { align: 'center' });
      if (book.subtitle) {
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'normal');
        pdf.text(book.subtitle, KDP_SPECS.pageWidth / 2, KDP_SPECS.pageHeight / 2 + 0.2, { align: 'center' });
      }
      if (book.author_name) {
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'italic');
        pdf.text(`By ${book.author_name}`, KDP_SPECS.pageWidth / 2, KDP_SPECS.pageHeight / 2 + 1.5, { align: 'center' });
      }
      currentPageIndex++;

      // Add Copyright Page (if content exists)
      if (book.copyright_text) {
        pdf.addPage([KDP_SPECS.pageWidth, KDP_SPECS.pageHeight]);
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, KDP_SPECS.pageWidth, KDP_SPECS.pageHeight, 'F');
        pdf.setTextColor(0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(book.copyright_text, KDP_SPECS.pageWidth / 2, KDP_SPECS.pageHeight - KDP_SPECS.safeMargin, { align: 'center' });
        currentPageIndex++;
      }

      // Process each coloring page
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        setProgress(Math.round(((i + 1) / pages.length) * 100));

        pdf.addPage([KDP_SPECS.pageWidth, KDP_SPECS.pageHeight]);
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, KDP_SPECS.pageWidth, KDP_SPECS.pageHeight, 'F');
        currentPageIndex++;

        try {
          const imgData = await loadImage(page.image_url);
          
          const imgAspect = imgData.width / imgData.height;
          const contentAspect = KDP_SPECS.contentWidth / KDP_SPECS.contentHeight;
          
          let imgWidth, imgHeight, imgX, imgY;
          
          if (imgAspect > contentAspect) {
            imgWidth = KDP_SPECS.contentWidth;
            imgHeight = imgWidth / imgAspect;
          } else {
            imgHeight = KDP_SPECS.contentHeight;
            imgWidth = imgHeight * imgAspect;
          }
          
          imgX = KDP_SPECS.bleed + (KDP_SPECS.contentWidth - imgWidth) / 2;
          imgY = KDP_SPECS.bleed + (KDP_SPECS.contentHeight - imgHeight) / 2;

          pdf.addImage(imgData.data, 'PNG', imgX, imgY, imgWidth, imgHeight);
        } catch (imgError) {
          console.error('Error loading image for page', i + 1, imgError);
          pdf.setFontSize(14);
          pdf.setTextColor(150);
          pdf.text(
            `Page ${i + 1} - Image could not be loaded`,
            KDP_SPECS.pageWidth / 2,
            KDP_SPECS.pageHeight / 2,
            { align: 'center' }
          );
        }

        // Add blank page for single-sided printing if not the last page
        if (singleSided && i < pages.length - 1) {
          pdf.addPage([KDP_SPECS.pageWidth, KDP_SPECS.pageHeight]);
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, KDP_SPECS.pageWidth, KDP_SPECS.pageHeight, 'F');
          currentPageIndex++;
        }
      }

      const filename = `${book.title.replace(/[^a-z0-9]/gi, '_')}_KDP_Interior.pdf`;
      pdf.save(filename);

      toast({
        title: 'PDF exported successfully!',
        description: `${pages.length} coloring pages exported with KDP bleed margins.`,
      });

      setOpen(false);
    } catch (err) {
      console.error('PDF export error:', err);
      toast({
        title: 'Export failed',
        description: 'There was an error creating your PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  const loadImage = (url: string): Promise<{ data: string; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        if (url.startsWith('data:')) {
          resolve({ data: url, width: img.width, height: img.height });
        } else {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve({ 
              data: canvas.toDataURL('image/png'), 
              width: img.width, 
              height: img.height 
            });
          } else {
            reject(new Error('Could not get canvas context'));
          }
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={pages.length === 0}
        className="glow-effect"
      >
        <FileDown className="h-4 w-4 mr-2" />
        Export PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export KDP-Ready PDF</DialogTitle>
            <DialogDescription>
              Generate a print-ready PDF with proper bleed margins for Amazon KDP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* KDP Specs Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                KDP Compliant Specifications
              </div>
              <ul className="text-muted-foreground space-y-1 ml-6">
                <li>• Page size: 8.5 × 11 inches (with bleed)</li>
                <li>• Bleed margins: 0.125" on all sides</li>
                <li>• Total document size: 8.75 × 11.25 inches</li>
                <li>• Safe content area: 8 × 10.5 inches</li>
                <li>• {pages.length} coloring pages + title/copyright pages</li>
              </ul>
            </div>

            {pages.length === 0 && (
              <div className="flex items-center gap-2 text-amber-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                Add pages to your book before exporting.
              </div>
            )}

            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="single-sided" className="flex flex-col space-y-1">
                <span>Single-sided printing</span>
                <span className="font-normal leading-snug text-muted-foreground">
                  Adds blank pages between coloring pages to prevent bleed-through.
                </span>
              </Label>
              <Switch
                id="single-sided"
                checked={singleSided}
                onCheckedChange={setSingleSided}
                disabled={exporting}
              />
            </div>

            {exporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Processing pages...</span>
                  <span className="text-foreground font-medium">{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button
              onClick={exportPDF}
              disabled={exporting || pages.length === 0}
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PDFExporter;