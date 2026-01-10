import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash2, GripVertical, FileImage } from 'lucide-react';
import { BookPage } from '@/hooks/useColoringBooks';

interface PageGalleryProps {
  pages: BookPage[];
  onDeletePage: (pageId: string) => void;
  onReorderPages: (pages: BookPage[]) => void;
}

const PageGallery = ({ pages, onDeletePage, onReorderPages }: PageGalleryProps) => {
  if (pages.length === 0) {
    return (
      <Card className="glass-card p-12 text-center">
        <FileImage className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No pages yet
        </h3>
        <p className="text-muted-foreground">
          Generate your first coloring page using the form above
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Book Pages ({pages.length})
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {pages.map((page, index) => (
          <Card
            key={page.id}
            className="glass-card overflow-hidden group relative"
          >
            <div className="aspect-[8.5/11] relative bg-white">
              <img
                src={page.image_url}
                alt={page.prompt}
                className="w-full h-full object-contain"
              />
              
              {/* Page number badge */}
              <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
                Page {page.page_number}
              </div>

              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => onDeletePage(page.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-3">
              <p className="text-xs text-muted-foreground truncate" title={page.prompt}>
                {page.prompt}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PageGallery;
