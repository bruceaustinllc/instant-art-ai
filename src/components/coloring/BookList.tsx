import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Book, Trash2, FileDown, Clock } from 'lucide-react';
import { ColoringBook } from '@/hooks/useColoringBooks';
import { formatDistanceToNow } from 'date-fns';

interface BookListProps {
  books: ColoringBook[];
  onSelectBook: (bookId: string) => void;
  onCreateBook: () => void;
  onDeleteBook: (bookId: string) => void;
  loading: boolean;
}

const BookList = ({
  books,
  onSelectBook,
  onCreateBook,
  onDeleteBook,
  loading,
}: BookListProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">My Coloring Books</h2>
        <Button onClick={onCreateBook} className="glow-effect">
          <Plus className="h-4 w-4 mr-2" />
          New Book
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-48 animate-shimmer" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <Book className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No coloring books yet
          </h3>
          <p className="text-muted-foreground mb-6">
            Create your first KDP-ready coloring book
          </p>
          <Button onClick={onCreateBook} className="glow-effect">
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Book
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => (
            <Card
              key={book.id}
              className="glass-card p-6 cursor-pointer hover:border-primary/50 transition-all group"
              onClick={() => onSelectBook(book.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {book.title}
                  </h3>
                  {book.description && (
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {book.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBook(book.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileDown className="h-4 w-4" />
                  {book.page_size}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDistanceToNow(new Date(book.updated_at), { addSuffix: true })}
                </div>
              </div>

              <div className="mt-4">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    book.status === 'published'
                      ? 'bg-green-500/20 text-green-400'
                      : book.status === 'ready'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {book.status.charAt(0).toUpperCase() + book.status.slice(1)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookList;