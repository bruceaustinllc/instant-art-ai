import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileDown, Book, Layers, Wand2, Settings, Upload } from 'lucide-react';
import { ColoringBook, BookPage } from '@/hooks/useColoringBooks';
import PageGenerator from './PageGenerator';
import BatchGenerator from './BatchGenerator';
import PageGallery from './PageGallery';
import PDFExporter from './PDFExporter';
import BookSettingsDialog from './BookSettingsDialog'; // New import
import PDFPreview from './PDFPreview'; // New import
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BookEditorProps {
  book: ColoringBook;
  pages: BookPage[];
  onBack: () => void;
  onAddPage: (prompt: string, imageUrl: string, artStyle: string) => Promise<any>;
  onDeletePage: (pageId: string) => void;
  onReorderPages: (pages: BookPage[]) => void;
  onUpdateBook: (bookId: string, updates: Partial<ColoringBook>) => Promise<any>; // New prop
}

const BookEditor = ({
  book,
  pages,
  onBack,
  onAddPage,
  onDeletePage,
  onReorderPages,
  onUpdateBook,
}: BookEditorProps) => {
  const [generatorTab, setGeneratorTab] = useState('single');
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const handleImportPages = () => {
    // Placeholder for future import functionality
    alert('Import Pages functionality coming soon!');
  };

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
          
          <PDFExporter book={book} pages={pages} />
        </div>
      </div>

      {/* Page Generators with Tabs */}
      <Tabs value={generatorTab} onValueChange={setGeneratorTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Single Page
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Batch Generate
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
      </Tabs>

      {/* Page Gallery and Import */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Book Pages ({pages.length})
        </h3>
        <Button variant="outline" size="sm" onClick={handleImportPages}>
          <Upload className="h-4 w-4 mr-2" />
          Import Pages
        </Button>
      </div>
      <PageGallery
        pages={pages}
        onDeletePage={onDeletePage}
        onReorderPages={onReorderPages}
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