-- Fix function search paths for security
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_doc_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  in_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  id uuid,
  doc_id uuid,
  page integer,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    doc_chunks.id,
    doc_chunks.doc_id,
    doc_chunks.page,
    doc_chunks.content,
    1 - (doc_chunks.embedding <=> query_embedding) AS similarity
  FROM public.doc_chunks
  WHERE doc_chunks.user_id = in_user_id
  ORDER BY doc_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;