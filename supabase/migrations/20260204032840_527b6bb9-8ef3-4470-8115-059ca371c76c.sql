-- Add category column to book_pages for organizing/filtering
ALTER TABLE public.book_pages ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;

-- Add status column for triage (keep/reject/needs_fix)
ALTER TABLE public.book_pages ADD COLUMN IF NOT EXISTS triage_status text DEFAULT 'pending';

-- Add rating column (1-5)
ALTER TABLE public.book_pages ADD COLUMN IF NOT EXISTS rating integer DEFAULT NULL;

-- Create index for fast filtering by category
CREATE INDEX IF NOT EXISTS idx_book_pages_category ON public.book_pages(book_id, category);

-- Create index for fast filtering by triage status
CREATE INDEX IF NOT EXISTS idx_book_pages_triage ON public.book_pages(book_id, triage_status);

-- Create index for fast filtering by rating
CREATE INDEX IF NOT EXISTS idx_book_pages_rating ON public.book_pages(book_id, rating);