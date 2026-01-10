-- Create profiles table for user accounts
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create coloring books table
CREATE TABLE public.coloring_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  page_size TEXT NOT NULL DEFAULT '8.5x11',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on coloring_books
ALTER TABLE public.coloring_books ENABLE ROW LEVEL SECURITY;

-- Coloring books policies
CREATE POLICY "Users can view their own books"
ON public.coloring_books FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own books"
ON public.coloring_books FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books"
ON public.coloring_books FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books"
ON public.coloring_books FOR DELETE
USING (auth.uid() = user_id);

-- Create book pages table
CREATE TABLE public.book_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES public.coloring_books(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  art_style TEXT NOT NULL DEFAULT 'line_art',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on book_pages
ALTER TABLE public.book_pages ENABLE ROW LEVEL SECURITY;

-- Book pages policies
CREATE POLICY "Users can view their own pages"
ON public.book_pages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pages"
ON public.book_pages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pages"
ON public.book_pages FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pages"
ON public.book_pages FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for coloring book images
INSERT INTO storage.buckets (id, name, public) VALUES ('coloring-pages', 'coloring-pages', true);

-- Storage policies
CREATE POLICY "Users can upload their own pages"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'coloring-pages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view coloring pages"
ON storage.objects FOR SELECT
USING (bucket_id = 'coloring-pages');

CREATE POLICY "Users can delete their own pages"
ON storage.objects FOR DELETE
USING (bucket_id = 'coloring-pages' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coloring_books_updated_at
BEFORE UPDATE ON public.coloring_books
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();