-- Add new fields to agents table
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS conversation_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS performance_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add new fields to chats table
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS chat_type TEXT DEFAULT 'general' CHECK (chat_type IN ('general', 'rag', 'multi_agent', 'support')),
ADD COLUMN IF NOT EXISTS agent_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS document_ids UUID[] DEFAULT '{}';

-- Add new fields to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id),
ADD COLUMN IF NOT EXISTS intent TEXT,
ADD COLUMN IF NOT EXISTS confidence FLOAT;

-- Create agent_conversations table for multi-agent conversations
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  agent_ids UUID[] NOT NULL,
  conversation_state JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create intent_classifications table
CREATE TABLE IF NOT EXISTS public.intent_classifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  intent TEXT NOT NULL,
  confidence FLOAT NOT NULL,
  suggested_agent_id UUID REFERENCES public.agents(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_classifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for new tables
CREATE POLICY "Users can view their own agent conversations" ON public.agent_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chats 
      WHERE chats.id = agent_conversations.chat_id AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own agent conversations" ON public.agent_conversations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chats 
      WHERE chats.id = agent_conversations.chat_id AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own intent classifications" ON public.intent_classifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.chats c ON m.chat_id = c.id
      WHERE m.id = intent_classifications.message_id AND c.user_id = auth.uid()
    )
  );

-- Insert seed data
-- 1. Test user (already exists from auth, but we'll ensure profile exists)
INSERT INTO public.profiles (user_id, email, display_name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@example.com',
  'Test User'
) ON CONFLICT (user_id) DO NOTHING;

-- 2. Test agents
INSERT INTO public.agents (id, name, description, prompt, user_id, role, model, is_active)
VALUES 
  (
    '11111111-1111-1111-1111-111111111111',
    'General Assistant',
    'General purpose AI assistant for everyday tasks',
    'You are a helpful AI assistant. Help users with general questions, writing, analysis, and problem-solving. Be friendly, accurate, and concise.',
    '00000000-0000-0000-0000-000000000001',
    'assistant',
    'gpt-4o-mini',
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Support Specialist',
    'Specialized in customer support and technical assistance',
    'You are a customer support specialist. Help users with technical issues, product questions, and troubleshooting. Be patient, clear, and solution-oriented.',
    '00000000-0000-0000-0000-000000000001',
    'support',
    'gpt-4o-mini',
    true
  );

-- 3. Test chats
INSERT INTO public.chats (id, user_id, title, chat_type, agent_ids, document_ids)
VALUES 
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000001',
    'Demo RAG',
    'rag',
    ARRAY['11111111-1111-1111-1111-111111111111'],
    ARRAY['44444444-4444-4444-4444-444444444444']
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '00000000-0000-0000-0000-000000000001',
    'Demo Agents',
    'multi_agent',
    ARRAY['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
    ARRAY[]::UUID[]
  );

-- 4. Test document
INSERT INTO public.documents (id, user_id, file_name, storage_path, pages, meta)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000001',
  'sample.pdf',
  'test-user/sample.pdf',
  3,
  '{"title": "Sample Document", "description": "A test document for RAG functionality"}'
);

-- 5. Test document chunks (with mock embeddings)
INSERT INTO public.doc_chunks (id, doc_id, user_id, page, content, embedding)
VALUES 
  (
    '66666666-6666-6666-6666-666666666666',
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000001',
    1,
    'This is the first page of the sample document. It contains introductory information about the topic.',
    '[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]'::vector
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000001',
    2,
    'The second page contains detailed information and examples. This is where the main content begins.',
    '[0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.1]'::vector
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000001',
    3,
    'The final page contains conclusions and summary. This wraps up the document content.',
    '[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.1, 0.2]'::vector
  );

-- 6. Test messages
INSERT INTO public.messages (id, chat_id, sender, content, agent_id, intent, confidence)
VALUES 
  (
    '99999999-9999-9999-9999-999999999999',
    '33333333-3333-3333-3333-333333333333',
    'user',
    'Hello! Can you help me understand this document?',
    NULL,
    'document_question',
    0.95
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    'agent',
    'Of course! I can see you have a document uploaded. What specific questions do you have about it? I can help analyze the content and answer your queries.',
    '11111111-1111-1111-1111-111111111111',
    'assistance_offered',
    0.98
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '55555555-5555-5555-5555-555555555555',
    'user',
    'I need help with a technical issue',
    NULL,
    'technical_support',
    0.92
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '55555555-5555-5555-5555-555555555555',
    'agent',
    'I can help you with technical issues! Let me gather some information to better assist you. What specific problem are you experiencing?',
    '22222222-2222-2222-2222-222222222222',
    'support_offered',
    0.96
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_conversations_chat_id ON public.agent_conversations(chat_id);
CREATE INDEX IF NOT EXISTS idx_intent_classifications_message_id ON public.intent_classifications(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON public.messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_intent ON public.messages(intent);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
