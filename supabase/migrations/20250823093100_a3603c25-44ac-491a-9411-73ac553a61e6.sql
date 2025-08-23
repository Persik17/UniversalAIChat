-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop old foreign key constraints and rename conversation_id to chat_id
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;
ALTER TABLE public.messages RENAME COLUMN conversation_id TO chat_id;

-- Drop conversations table and create chats table
DROP TABLE IF EXISTS public.conversations CASCADE;

CREATE TABLE IF NOT EXISTS public.chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Update messages table structure
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS sender TEXT DEFAULT 'user' CHECK (sender IN ('user', 'agent')),
ADD COLUMN IF NOT EXISTS model TEXT,
ADD COLUMN IF NOT EXISTS msg_type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';

-- Add foreign key constraint for chat_id
ALTER TABLE public.messages 
ADD CONSTRAINT messages_chat_id_fkey 
FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;

-- Update agents table with enhanced fields
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'assistant',
ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gpt-4o-mini';

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  pages INTEGER DEFAULT 0,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create doc_chunks table with vector embeddings
CREATE TABLE IF NOT EXISTS public.doc_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_doc_id ON public.doc_chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_user_id ON public.doc_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding ON public.doc_chunks USING ivfflat (embedding vector_cosine_ops);

-- Enable RLS on all tables
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chats
CREATE POLICY "Users can view their own chats" ON public.chats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own chats" ON public.chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own chats" ON public.chats
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chats" ON public.chats
  FOR DELETE USING (auth.uid() = user_id);

-- Update agents RLS policies to include user_id
DROP POLICY IF EXISTS "Only authenticated users can create agents" ON public.agents;
DROP POLICY IF EXISTS "Only authenticated users can update agents" ON public.agents;
CREATE POLICY "Users can create their own agents" ON public.agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own agents" ON public.agents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own agents" ON public.agents
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for documents
CREATE POLICY "Users can view their own documents" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for doc_chunks
CREATE POLICY "Users can view their own doc chunks" ON public.doc_chunks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own doc chunks" ON public.doc_chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own doc chunks" ON public.doc_chunks
  FOR DELETE USING (auth.uid() = user_id);

-- Function to search document chunks by similarity
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

-- Update existing messages policies to work with new structure
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;
CREATE POLICY "Users can create messages in their chats" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chats 
      WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can view messages from their chats" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chats 
      WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents
CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );