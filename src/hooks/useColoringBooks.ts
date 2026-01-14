import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export interface ColoringBook {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null; // New field for series subtitle
  description: string | null;
  author_name: string | null; // New field for author name
  copyright_text: string | null; // New field for copyright information
  page_size: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BookPage {
  id: string;
  book_id: string;
  user_id: string;
  prompt: string;
  image_url: string;
  page_number: number;
  art_style: string;
  created_at: string;
}

export const useColoringBooks = () => {
  const { user } = useAuth();
  const [books, setBooks] = useState<ColoringBook[]>([]);
  const [currentBook, setCurrentBook] = useState<ColoringBook | null>(null);
  const [pages, setPages] = useState<BookPage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBooks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('coloring_books')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setBooks((data || []) as ColoringBook[]);
    } catch (err) {
      console.error('Error fetching books:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPages = useCallback(async (bookId: string) => {
    try {
      const { data, error } = await supabase
        .from('book_pages')
        .select('*')
        .eq('book_id', bookId)
        .order('page_number', { ascending: true });

      if (error) throw error;
      setPages(data || []);
    } catch (err) {
      console.error('Error fetching pages:', err);
    }
  }, []);

  const createBook = useCallback(async (title: string, description?: string) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('coloring_books')
        .insert({
          user_id: user.id,
          title,
          description,
          page_size: '8.5x11',
          subtitle: null, // Default new fields
          author_name: user.email || null, // Default author to user email
          copyright_text: `© ${new Date().getFullYear()} ${user.email || 'Your Name'}`, // Default copyright
        } as TablesInsert<'coloring_books'>) // Corrected type assertion
        .select()
        .single();

      if (error) throw error;
      setBooks(prev => [data as ColoringBook, ...prev]);
      setCurrentBook(data as ColoringBook);
      return data;
    } catch (err) {
      console.error('Error creating book:', err);
      return null;
    }
  }, [user]);

  const updateBook = useCallback(async (bookId: string, updates: Partial<Omit<ColoringBook, 'id' | 'user_id' | 'created_at'>>) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('coloring_books')
        .update({ ...updates, updated_at: new Date().toISOString() } as TablesUpdate<'coloring_books'>) // Corrected type assertion
        .eq('id', bookId)
        .select()
        .single();

      if (error) throw error;
      setBooks(prev => prev.map(b => b.id === bookId ? data as ColoringBook : b));
      if (currentBook?.id === bookId) {
        setCurrentBook(data as ColoringBook);
      }
      return data;
    } catch (err) {
      console.error('Error updating book:', err);
      return null;
    }
  }, [user, currentBook]);

  const selectBook = useCallback(async (bookId: string) => {
    const book = books.find(b => b.id === bookId);
    if (book) {
      setCurrentBook(book);
      await fetchPages(bookId);
    }
  }, [books, fetchPages]);

  const addPage = useCallback(async (
    bookId: string,
    prompt: string,
    imageUrl: string,
    artStyle: string = 'line_art'
  ) => {
    if (!user) return null;
    try {
      // Get next page number
      const nextPageNumber = pages.length + 1;

      const { data, error } = await supabase
        .from('book_pages')
        .insert({
          book_id: bookId,
          user_id: user.id,
          prompt,
          image_url: imageUrl,
          page_number: nextPageNumber,
          art_style: artStyle,
        })
        .select()
        .single();

      if (error) throw error;
      setPages(prev => [...prev, data]);
      return data;
    } catch (err) {
      console.error('Error adding page:', err);
      return null;
    }
  }, [user, pages.length]);

  const deletePage = useCallback(async (pageId: string) => {
    try {
      const { error } = await supabase
        .from('book_pages')
        .delete()
        .eq('id', pageId);

      if (error) throw error;
      setPages(prev => prev.filter(p => p.id !== pageId).map((p, idx) => ({ ...p, page_number: idx + 1 })));
    } catch (err) {
      console.error('Error deleting page:', err);
    }
  }, []);

  const deleteBook = useCallback(async (bookId: string) => {
    try {
      const { error } = await supabase
        .from('coloring_books')
        .delete()
        .eq('id', bookId);

      if (error) throw error;
      setBooks(prev => prev.filter(b => b.id !== bookId));
      if (currentBook?.id === bookId) {
        setCurrentBook(null);
        setPages([]);
      }
    } catch (err) {
      console.error('Error deleting book:', err);
    }
  }, [currentBook]);

  const updateBookStatus = useCallback(async (bookId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('coloring_books')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', bookId);

      if (error) throw error;
      setBooks(prev => prev.map(b => b.id === bookId ? { ...b, status } : b));
      if (currentBook?.id === bookId) {
        setCurrentBook(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      console.error('Error updating book status:', err);
    }
  }, [currentBook]);

  const reorderPages = useCallback(async (reorderedPages: BookPage[]) => {
    setPages(reorderedPages);
    // Update page numbers in database
    for (let i = 0; i < reorderedPages.length; i++) {
      await supabase
        .from('book_pages')
        .update({ page_number: i + 1 })
        .eq('id', reorderedPages[i].id);
    }
  }, []);

  return {
    books,
    currentBook,
    pages,
    loading,
    fetchBooks,
    createBook,
    updateBook,
    selectBook,
    addPage,
    deletePage,
    deleteBook,
    updateBookStatus,
    reorderPages,
    setCurrentBook,
    setPages,
  };
};