-- Speed up ordered page fetches per book
CREATE INDEX IF NOT EXISTS idx_book_pages_book_id_page_number
ON public.book_pages (book_id, page_number);
