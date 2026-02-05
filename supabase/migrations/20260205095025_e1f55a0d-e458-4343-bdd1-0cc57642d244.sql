-- Speed up export pagination queries (prevents statement timeout during large exports)
CREATE INDEX IF NOT EXISTS book_pages_book_id_page_number_idx
ON public.book_pages (book_id, page_number);
