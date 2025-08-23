-- Comprehensive seed data for Universal AI Chat
-- This migration adds test users, agents, chats, documents, and messages

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Insert test users (these will be created in Supabase Auth)
-- Note: In production, users are created through Supabase Auth
-- Here we're just creating the profiles

-- Insert test agents
INSERT INTO public.agents (
  id,
  user_id,
  name,
  description,
  system_prompt,
  role,
  is_active,
  conversation_history,
  performance_metrics,
  last_updated
) VALUES 
(
  '550e8400-e29b-41d4-a716-446655440001',
  '00000000-0000-0000-0000-000000000001', -- Will be replaced with actual user ID
  'Researcher',
  'AI агент для исследовательских задач и анализа данных',
  'Ты - AI исследователь, специализирующийся на анализе данных, поиске информации и создании отчетов. Твоя задача - помогать пользователям находить релевантную информацию, анализировать данные и формулировать выводы на основе фактов.',
  'researcher',
  true,
  '[]'::jsonb,
  '{"accuracy": 0.92, "response_time": 1.2, "user_satisfaction": 4.8}'::jsonb,
  NOW()
),
(
  '550e8400-e29b-41d4-a716-446655440002',
  '00000000-0000-0000-0000-000000000001', -- Will be replaced with actual user ID
  'Support Agent',
  'AI агент для технической поддержки и решения проблем',
  'Ты - AI агент технической поддержки. Твоя задача - помогать пользователям решать технические проблемы, отвечать на вопросы о продуктах и услугах, и обеспечивать качественную поддержку. Всегда будь вежливым, терпеливым и стремись к решению проблемы.',
  'support',
  true,
  '[]'::jsonb,
  '{"accuracy": 0.89, "response_time": 0.8, "user_satisfaction": 4.6}'::jsonb,
  NOW()
);

-- Insert test chats
INSERT INTO public.chats (
  id,
  user_id,
  title,
  chat_type,
  agent_ids,
  document_ids,
  created_at,
  updated_at
) VALUES 
(
  '550e8400-e29b-41d4-a716-446655440003',
  '00000000-0000-0000-0000-000000000001', -- Will be replaced with actual user ID
  'Research Session',
  'multi_agent',
  ARRAY['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
  ARRAY['550e8400-e29b-41d4-a716-446655440005'],
  NOW(),
  NOW()
),
(
  '550e8400-e29b-41d4-a716-446655440004',
  '00000000-0000-0000-0000-000000000001', -- Will be replaced with actual user ID
  'Technical Support',
  'support',
  ARRAY['550e8400-e29b-41d4-a716-446655440002'],
  ARRAY[]::uuid[],
  NOW(),
  NOW()
);

-- Insert test document
INSERT INTO public.documents (
  id,
  user_id,
  file_name,
  storage_path,
  pages,
  meta,
  created_at
) VALUES 
(
  '550e8400-e29b-41d4-a716-446655440005',
  '00000000-0000-0000-0000-000000000001', -- Will be replaced with actual user ID
  'AI_Research_Guide.pdf',
  'documents/ai_research_guide.pdf',
  15,
  '{"file_size": 2048576, "author": "AI Research Team", "keywords": ["AI", "research", "machine learning"]}'::jsonb,
  NOW()
);

-- Insert document chunks for RAG
INSERT INTO public.document_chunks (
  id,
  document_id,
  content,
  embedding,
  page_number,
  chunk_index,
  created_at
) VALUES 
(
  '550e8400-e29b-41d4-a716-446655440006',
  '550e8400-e29b-41d4-a716-446655440005',
  'Artificial Intelligence (AI) is a branch of computer science that aims to create intelligent machines that work and react like humans. Some of the activities computers with artificial intelligence are designed for include speech recognition, learning, planning, and problem solving.',
  '[0.1, 0.2, 0.3, 0.4, 0.5]'::vector,
  1,
  0,
  NOW()
),
(
  '550e8400-e29b-41d4-a716-446655440007',
  '550e8400-e29b-41d4-a716-446655440005',
  'Machine Learning is a subset of AI that provides systems the ability to automatically learn and improve from experience without being explicitly programmed. Machine learning focuses on the development of computer programs that can access data and use it to learn for themselves.',
  '[0.2, 0.3, 0.4, 0.5, 0.6]'::vector,
  2,
  0,
  NOW()
),
(
  '550e8400-e29b-41d4-a716-446655440008',
  '550e8400-e29b-41d4-a716-446655440005',
  'Deep Learning is a subset of machine learning that uses neural networks with multiple layers to model and understand complex patterns. It has been particularly successful in areas such as image recognition, natural language processing, and speech recognition.',
  '[0.3, 0.4, 0.5, 0.6, 0.7]'::vector,
  3,
  0,
  NOW()
);

-- Insert test messages
INSERT INTO public.messages (
  id,
  chat_id,
  sender,
  content,
  role,
  agent_id,
  intent,
  confidence,
  meta,
  model,
  msg_type,
  created_at
) VALUES 
(
  '550e8400-e29b-41d4-a716-446655440009',
  '550e8400-e29b-41d4-a716-446655440003',
  'user',
  'Привет! Мне нужно провести исследование по теме искусственного интеллекта. Можешь помочь?',
  'user',
  NULL,
  'research_request',
  0.95,
  '{}'::jsonb,
  'gpt-4o-mini',
  'text',
  NOW() - INTERVAL '1 hour'
),
(
  '550e8400-e29b-41d4-a716-446655440010',
  '550e8400-e29b-41d4-a716-446655440003',
  'Researcher',
  'Конечно! Я помогу вам с исследованием по ИИ. Я вижу, что у нас есть документ "AI Research Guide" с полезной информацией. Давайте начнем с анализа основных концепций машинного обучения и глубокого обучения.',
  'assistant',
  '550e8400-e29b-41d4-a716-446655440001',
  'research_assistance',
  0.92,
  '{}'::jsonb,
  'gpt-4o-mini',
  'text',
  NOW() - INTERVAL '45 minutes'
),
(
  '550e8400-e29b-41d4-a716-446655440011',
  '550e8400-e29b-41d4-a716-446655440004',
  'user',
  'У меня проблема с загрузкой документов. Не могу загрузить PDF файл.',
  'user',
  NULL,
  'technical_support',
  0.98,
  '{}'::jsonb,
  'gpt-4o-mini',
  'text',
  NOW() - INTERVAL '30 minutes'
),
(
  '550e8400-e29b-41d4-a716-446655440012',
  '550e8400-e29b-41d4-a716-446655440004',
  'Support Agent',
  'Понимаю вашу проблему. Давайте разберемся с загрузкой PDF. Сначала проверьте: 1) Размер файла (максимум 10MB), 2) Формат файла (должен быть PDF), 3) Стабильность интернет-соединения. Если проблема остается, опишите точную ошибку.',
  'assistant',
  '550e8400-e29b-41d4-a716-446655440002',
  'technical_support',
  0.89,
  '{}'::jsonb,
  'gpt-4o-mini',
  'text',
  NOW() - INTERVAL '25 minutes'
);

-- Insert agent conversations
INSERT INTO public.agent_conversations (
  id,
  chat_id,
  agent_ids,
  conversation_state,
  created_at,
  updated_at
) VALUES 
(
  '550e8400-e29b-41d4-a716-446655440013',
  '550e8400-e29b-41d4-a716-446655440003',
  ARRAY['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
  '{"currentTurn": 2, "maxTurns": 5, "agents": ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"], "topic": "AI Research Analysis", "status": "active", "messages": [{"agentId": "550e8400-e29b-41d4-a716-446655440001", "agentName": "Researcher", "content": "Начинаю анализ документа", "timestamp": "2024-01-01T10:00:00Z", "reasoning": "Initial research start"}, {"agentId": "550e8400-e29b-41d4-a716-446655440002", "agentName": "Support Agent", "content": "Готов помочь с техническими вопросами", "timestamp": "2024-01-01T10:01:00Z", "reasoning": "Support readiness"}]}'::jsonb,
  NOW(),
  NOW()
);

-- Insert intent classifications
INSERT INTO public.intent_classifications (
  id,
  message_id,
  intent,
  confidence,
  suggested_agent_id,
  reasoning,
  created_at
) VALUES 
(
  '550e8400-e29b-41d4-a716-446655440014',
  '550e8400-e29b-41d4-a716-446655440009',
  'research_request',
  0.95,
  '550e8400-e29b-41d4-a716-446655440001',
  'User asking for research assistance with AI topic',
  NOW() - INTERVAL '1 hour'
),
(
  '550e8400-e29b-41d4-a716-446655440015',
  '550e8400-e29b-41d4-a716-446655440011',
  'technical_support',
  0.98,
  '550e8400-e29b-41d4-a716-446655440002',
  'User reporting technical issue with document upload',
  NOW() - INTERVAL '30 minutes'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON public.messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_intent ON public.messages(intent);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_chat_id ON public.agent_conversations(chat_id);
CREATE INDEX IF NOT EXISTS idx_intent_classifications_message_id ON public.intent_classifications(message_id);

-- Add updated_at triggers for new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agent_conversations_updated_at 
    BEFORE UPDATE ON public.agent_conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_intent_classifications_updated_at 
    BEFORE UPDATE ON public.intent_classifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
