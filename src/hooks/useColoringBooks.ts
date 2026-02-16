import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { TablesUpdate } from '@/integrations/supabase/types';

export interface ColoringBook {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  page_size: string;
  status: string;
  created_at: string;
  updated_at: string;
  // Optional metadata (stored in description as JSON or separate fields if added later)
  subtitle?: string;
  author_name?: string;
  copyright_text?: string;
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
  category?: string | null;
  triage_status?: string;
  rating?: number | null;
}

export const useColoringBooks = () => {
  const { user } = useAuth();
  const effectiveUserId = user?.id;
  const [books, setBooks] = useState<ColoringBook[]>([]);
  const [currentBook, setCurrentBook] = useState<ColoringBook | null>(null);
  const [pages, setPages] = useState<BookPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagesHasMore, setPagesHasMore] = useState(false);
  const [pagesLoadingMore, setPagesLoadingMore] = useState(false);
  const activePagesFetchRef = useRef(0);
  const pagesPagingRef = useRef<{
    bookId: string | null;
    total: number;
    nextOffset: number;
    batchSize: number;
    fetchToken: number;
  }>({
    bookId: null,
    total: 0,
    nextOffset: 0,
    batchSize: 4,
    fetchToken: 0,
  });

  const fetchBooks = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('coloring_books')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setBooks((data || []) as ColoringBook[]);
    } catch (err) {
      console.error('Error fetching books:', err);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  const fetchPages = useCallback(async (bookId: string) => {
    // NOTE: Some books can have very large image_url payloads.
    // Fetching everything at once can cause backend timeouts.
    const fetchToken = ++activePagesFetchRef.current;

    // Reset immediately so UI doesn't look stuck on stale state
    setPages([]);
    setPagesHasMore(false);
    setPagesLoadingMore(true);

    const PAGE_BATCH_SIZE = pagesPagingRef.current.batchSize;

    try {
      // Get row count without fetching heavy columns
      const { count, error: countError } = await supabase
        .from('book_pages')
        .select('id', { count: 'exact', head: true })
        .eq('book_id', bookId);

      if (countError) throw countError;

      const total = count ?? 0;
      if (total === 0) {
        setPages([]);
        setPagesHasMore(false);
        return;
      }

      // Store paging state for subsequent “Load more” actions
      pagesPagingRef.current = {
        bookId,
        total,
        nextOffset: 0,
        batchSize: PAGE_BATCH_SIZE,
        fetchToken,
      };

      // Fetch ONLY the first batch. More pages are fetched on-demand.
      const { data, error } = await supabase
        .from('book_pages')
        .select('id, book_id, user_id, prompt, image_url, page_number, art_style, created_at')
        .eq('book_id', bookId)
        .order('page_number', { ascending: true })
        .range(0, PAGE_BATCH_SIZE - 1);

      if (error) throw error;

      const firstBatch = (data || []) as BookPage[];
      setPages(firstBatch);

      const nextOffset = firstBatch.length;
      pagesPagingRef.current.nextOffset = nextOffset;
      setPagesHasMore(nextOffset < total);
    } catch (err) {
      console.error('Error fetching pages:', err);
      setPagesHasMore(false);
    } finally {
      setPagesLoadingMore(false);
    }
  }, []);

  const fetchMorePages = useCallback(async (bookId: string) => {
    const paging = pagesPagingRef.current;
    if (paging.bookId !== bookId) return;
    if (!pagesHasMore) return;
    if (pagesLoadingMore) return;
    if (activePagesFetchRef.current !== paging.fetchToken) return; // superseded

    const { nextOffset, batchSize, total } = paging;
    setPagesLoadingMore(true);

    try {
      const { data, error } = await supabase
        .from('book_pages')
        .select('id, book_id, user_id, prompt, image_url, page_number, art_style, created_at')
        .eq('book_id', bookId)
        .order('page_number', { ascending: true })
        .range(nextOffset, nextOffset + batchSize - 1);

      if (error) throw error;

      const batch = (data || []) as BookPage[];
      if (batch.length === 0) {
        setPagesHasMore(false);
        return;
      }

      setPages((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev, ...batch.filter((p) => !seen.has(p.id))];
        merged.sort((a, b) => a.page_number - b.page_number);
        return merged;
      });

      const newOffset = nextOffset + batch.length;
      pagesPagingRef.current.nextOffset = newOffset;
      setPagesHasMore(newOffset < total);
    } catch (err) {
      console.error('Error fetching more pages:', err);
    }
    finally {
      setPagesLoadingMore(false);
    }
  }, [pagesHasMore, pagesLoadingMore]);

  const createBook = useCallback(async (title: string, description?: string) => {
    if (!effectiveUserId) return null;
    try {
      const { data, error } = await supabase
        .from('coloring_books')
        .insert({
          user_id: effectiveUserId,
          title,
          description,
          page_size: '8.5x11',
        })
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
  }, [effectiveUserId]);

  const updateBook = useCallback(async (bookId: string, updates: Partial<Omit<ColoringBook, 'id' | 'user_id' | 'created_at'>>) => {
    if (!effectiveUserId) return null;
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
    if (!effectiveUserId) return null;
    try {
      // Get next page number
      const nextPageNumber = pages.length + 1;

      const { data, error } = await supabase
        .from('book_pages')
        .insert({
          book_id: bookId,
          user_id: effectiveUserId,
          prompt,
          image_url: imageUrl,
          page_number: nextPageNumber,
          art_style: artStyle,
        })
        .select()
        .single();

      if (error) throw error;
      setPages(prev => [...prev, data as BookPage]);
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
    pagesHasMore,
    pagesLoadingMore,
    fetchBooks,
    createBook,
    updateBook,
    selectBook,
    fetchMorePages,
    addPage,
    deletePage,
    deleteBook,
    updateBookStatus,
    reorderPages,
    setCurrentBook,
    setPages,
  };
};