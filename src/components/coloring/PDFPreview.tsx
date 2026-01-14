import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ColoringBook, BookPage } from '@/hooks/useColoringBooks';
import { Image, Ruler, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PDFPreviewProps {
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

const PDFPreview = ({ book, pages }: PDFPreviewProps) => {
  const [showBleedGuides, setShowBleedGuides] = useState(true);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const generatePreviews = async () => {
      setLoading(true);
      const generatedPreviews: string[] = [];

      // Add Title Page Preview
      generatedPreviews.push(await createTitlePagePreview(book));

      // Add Copyright Page Preview (if content exists)
      if (book.copyright_text) {
        generatedPreviews.push(await createCopyrightPagePreview(book));
      }

      // Add Coloring Page Previews
      for (const page of pages) {
        generatedPreviews.push(await createColoringPagePreview(page));
      }
      setPreviewPages(generatedPreviews);
      setLoading(false);
    };

    generatePreviews();
  }, [book, pages]);

  const createTitlePagePreview = async (book: ColoringBook): Promise<string> => {
    const canvas = document.createElement('canvas');
    const scale = 100; // pixels per inch
    canvas.width = KDP_SPECS.pageWidth * scale;
    canvas.height = KDP_SPECS.pageHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';

    ctx.font = `bold ${36 * scale / 72}px sans-serif`; // 72 points per inch
    ctx.fillText(book.title, canvas.width / 2, canvas.height / 2 - 1 * scale);

    if (book.subtitle) {
      ctx.font = `${24 * scale / 72}px sans-serif`;
      ctx.fillText(book.subtitle, canvas.width / 2, canvas.height / 2 + 0.2 * scale);
    }
    if (book.author_name) {
      ctx.font = `italic ${18 * scale / 72}px sans-serif`;
      ctx.fillText(`By ${book.author_name}`, canvas.width / 2, canvas.height / 2 + 1.5 * scale);
    }

    return canvas.toDataURL('image/png');
  };

  const createCopyrightPagePreview = async (book: ColoringBook): Promise<string> => {
    const canvas = document.createElement('canvas');
    const scale = 100;
    canvas.width = KDP_SPECS.pageWidth * scale;
    canvas.height = KDP_SPECS.pageHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    ctx.font = `${10 * scale / 72}px sans-serif`;
    ctx.fillText(book.copyright_text || '', canvas.width / 2, canvas.height - KDP_SPECS.safeMargin * scale);

    return canvas.toDataURL('image/png');
  };

  const createColoringPagePreview = async (page: BookPage): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 100; // pixels per inch
        canvas.width = KDP_SPECS.pageWidth * scale;
        canvas.height = KDP_SPECS.pageHeight * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const imgAspect = img.width / img.height;
        const contentWidthPx = KDP_SPECS.contentWidth * scale;
        const contentHeightPx = KDP_SPECS.contentHeight * scale;
        const contentAspect = contentWidthPx / contentHeightPx;

        let drawWidth, drawHeight, drawX, drawY;

        if (imgAspect > contentAspect) {
          drawWidth = contentWidthPx;
          drawHeight = drawWidth / imgAspect;
        } else {
          drawHeight = contentHeightPx;
          drawWidth = drawHeight * imgAspect;
        }

        drawX = KDP_SPECS.bleed * scale + (contentWidthPx - drawWidth) / 2;
        drawY = KDP_SPECS.bleed * scale + (contentHeightPx - drawHeight) / 2;

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(''); // Resolve with empty string on error
      img.src = page.image_url;
    });
  };

  if (pages.length === 0 && !book.title) {
    return null; // Don't show preview if no pages and no book title
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          KDP Live Preview
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBleedGuides(!showBleedGuides)}
        >
          {showBleedGuides ? (
            <>
              <X className="h-4 w-4 mr-2" /> Hide Guides
            </>
          ) : (
            <>
              <Ruler className="h-4 w-4 mr-2" /> Show Guides
            </>
          )}
        </Button>
      </div>

      {loading ? (
        <Card className="glass-card p-12 text-center animate-shimmer">
          <Image className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Generating preview...
          </h3>
          <p className="text-muted-foreground">
            This may take a moment for all pages.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {previewPages.map((dataUrl, index) => (
            <div key={index} className="relative aspect-[8.5/11] overflow-hidden rounded-lg shadow-lg">
              <img src={dataUrl} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
              {showBleedGuides && (
                <>
                  {/* Bleed guide (red border) */}
                  <div
                    className="absolute inset-0 border-2 border-red-500/50 pointer-events-none"
                    style={{
                      top: `${(KDP_SPECS.bleed / KDP_SPECS.pageHeight) * 100}%`,
                      left: `${(KDP_SPECS.bleed / KDP_SPECS.pageWidth) * 100}%`,
                      right: `${(KDP_SPECS.bleed / KDP_SPECS.pageWidth) * 100}%`,
                      bottom: `${(KDP_SPECS.bleed / KDP_SPECS.pageHeight) * 100}%`,
                    }}
                  />
                  {/* Safe content guide (green border) */}
                  <div
                    className="absolute border-2 border-green-500/50 pointer-events-none"
                    style={{
                      top: `${(KDP_SPECS.safeMargin / KDP_SPECS.pageHeight) * 100}%`,
                      left: `${(KDP_SPECS.safeMargin / KDP_SPECS.pageWidth) * 100}%`,
                      right: `${(KDP_SPECS.safeMargin / KDP_SPECS.pageWidth) * 100}%`,
                      bottom: `${(KDP_SPECS.safeMargin / KDP_SPECS.pageHeight) * 100}%`,
                    }}
                  />
                </>
              )}
              <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
                Page {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PDFPreview;