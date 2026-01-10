import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, BookOpen, Palette } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useColoringBooks } from '@/hooks/useColoringBooks';
import BookList from './BookList';
import BookEditor from './BookEditor';
import CreateBookDialog from './CreateBookDialog';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const {
    books,
    currentBook,
    pages,
    loading,
    fetchBooks,
    createBook,
    selectBook,
    addPage,
    deletePage,
    deleteBook,
    reorderPages,
    setCurrentBook,
    setPages,
  } = useColoringBooks();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleBackToList = () => {
    setCurrentBook(null);
    setPages([]);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <BookOpen className="h-8 w-8 text-primary" />
              <Palette className="h-4 w-4 text-primary absolute -bottom-0.5 -right-0.5" />
            </div>
            <span className="text-xl font-bold gradient-text">
              Coloring Book Creator
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {currentBook ? (
          <BookEditor
            book={currentBook}
            pages={pages}
            onBack={handleBackToList}
            onAddPage={(prompt, imageUrl, artStyle) => 
              addPage(currentBook.id, prompt, imageUrl, artStyle)
            }
            onDeletePage={deletePage}
            onReorderPages={reorderPages}
          />
        ) : (
          <BookList
            books={books}
            onSelectBook={selectBook}
            onCreateBook={() => setCreateDialogOpen(true)}
            onDeleteBook={deleteBook}
            loading={loading}
          />
        )}
      </main>

      {/* Create Book Dialog */}
      <CreateBookDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={createBook}
      />

      {/* Footer */}
      <footer className="py-6 text-center text-muted-foreground text-sm border-t border-border">
        <p>Built for KDP Publishing ✨</p>
      </footer>
    </div>
  );
};

export default Dashboard;
