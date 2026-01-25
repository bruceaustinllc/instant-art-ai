-- Enable realtime for generation_jobs table so users can see live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_jobs;