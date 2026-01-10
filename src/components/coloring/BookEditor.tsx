import { Button } from '@/components/ui/button';
import { ArrowLeft, FileDown, Book } from 'lucide-react';
import { ColoringBook, BookPage } from '@/hooks/useColoringBooks';
import PageGenerator from './PageGenerator';
import PageGallery from './PageGallery';
import PDFExporter from './PDFExporter';

interface BookEditorProps {
  book: ColoringBook;
  pages: BookPage[];
  onBack: () => void;
  onAddPage: (prompt: string, imageUrl: string, artStyle: string) => Promise<any>;
  onDeletePage: (pageId: string) => void;
  onReorderPages: (pages: BookPage[]) => void;
}

const BookEditor = ({
  book,
  pages,
  onBack,
  onAddPage,
  onDeletePage,
  onReorderPages,
}: BookEditorProps) => {
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
            {book.description && (
              <p className="text-muted-foreground text-sm">{book.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground mr-4">
            <Book className="h-4 w-4 inline mr-1" />
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </div>
          
          <PDFExporter book={book} pages={pages} />
        </div>
      </div>

      {/* Page Generator */}
      <PageGenerator
        bookId={book.id}
        onPageGenerated={(prompt, imageUrl, artStyle) => 
          onAddPage(prompt, imageUrl, artStyle)
        }
      />

      {/* Page Gallery */}
      <PageGallery
        pages={pages}
        onDeletePage={onDeletePage}
        onReorderPages={onReorderPages}
      />
    </div>
  );
};

export default BookEditor;
