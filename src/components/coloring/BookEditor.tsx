import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Book, Layers, Wand2, Settings, Upload, ImageIcon } from 'lucide-react';
import { ColoringBook, BookPage } from '@/hooks/useColoringBooks';
import PageGenerator from './PageGenerator';
import BatchGenerator from './BatchGenerator';
import ImageUploadConverter from './ImageUploadConverter';
import PageGallery from './PageGallery';
import PDFExporter from './PDFExporter';
import BookSettingsDialog from './BookSettingsDialog';
import PDFPreview from './PDFPreview';
import ExportAllButton from './ExportAllButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BookEditorProps {
  book: ColoringBook;
  pages: BookPage[];
  onBack: () => void;
  onAddPage: (prompt: string, imageUrl: string, artStyle: string) => Promise<any>;
  onDeletePage: (pageId: string) => void;
  onReorderPages: (pages: BookPage[]) => void;
  onUpdateBook: (bookId: string, updates: Partial<ColoringBook>) => Promise<any>;
  hasMorePages: boolean;
  loadingMorePages: boolean;
  onLoadMorePages: () => void;
}

const BookEditor = ({
  book,
  pages,
  onBack,
  onAddPage,
  onDeletePage,
  onReorderPages,
  onUpdateBook,
  hasMorePages,
  loadingMorePages,
  onLoadMorePages,
}: BookEditorProps) => {
  const [generatorTab, setGeneratorTab] = useState('single');
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{book.title}</h1>
            {book.subtitle && (
              <p className="text-muted-foreground text-sm">{book.subtitle}</p>
            )}
            {book.description && (
              <p className="text-muted-foreground text-sm">{book.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground mr-4 hidden sm:flex items-center gap-1">
            <Book className="h-4 w-4 inline mr-1" />
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </div>
          
          <Button variant="ghost" size="icon" onClick={() => setSettingsDialogOpen(true)}>
            <Settings className="h-4 w-4" />
            <span className="sr-only">Book Settings</span>
          </Button>
          
          <ExportAllButton bookId={book.id} bookTitle={book.title} />
          <PDFExporter book={book} pages={pages} />
        </div>
      </div>

      {/* Page Generators with Tabs */}
      <Tabs value={generatorTab} onValueChange={setGeneratorTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">AI Generate</span>
            <span className="sm:hidden">AI</span>
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Batch</span>
            <span className="sm:hidden">Batch</span>
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
            <span className="sm:hidden">Upload</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-4">
          <PageGenerator
            bookId={book.id}
            onPageGenerated={(prompt, imageUrl, artStyle) => 
              onAddPage(prompt, imageUrl, artStyle)
            }
          />
        </TabsContent>

        <TabsContent value="batch" className="mt-4">
          <BatchGenerator
            bookId={book.id}
            currentPageCount={pages.length}
            onPageGenerated={(prompt, imageUrl, artStyle) => 
              onAddPage(prompt, imageUrl, artStyle)
            }
          />
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <ImageUploadConverter
            bookId={book.id}
            onPageGenerated={(prompt, imageUrl, artStyle) => 
              onAddPage(prompt, imageUrl, artStyle)
            }
          />
        </TabsContent>
      </Tabs>

      {/* Page Gallery */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Book Pages ({pages.length})
        </h3>
      </div>
      <PageGallery
        pages={pages}
        onDeletePage={onDeletePage}
        onReorderPages={onReorderPages}
        hasMore={hasMorePages}
        loadingMore={loadingMorePages}
        onLoadMore={onLoadMorePages}
      />

      {/* PDF Preview */}
      <PDFPreview book={book} pages={pages} />

      {/* Book Settings Dialog */}
      {book && (
        <BookSettingsDialog
          open={settingsDialogOpen}
          onClose={() => setSettingsDialogOpen(false)}
          book={book}
          onSave={onUpdateBook}
        />
      )}
    </div>
  );
};

export default BookEditor;
