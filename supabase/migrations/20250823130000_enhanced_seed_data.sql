-- Enhanced seed data for Universal AI Chat
-- This migration creates comprehensive test data including users, agents, chats, documents, and embeddings

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: In production, users are created through Supabase Auth
-- These will be actual authenticated users with real UUIDs

-- Insert enhanced test agents with detailed prompts
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
-- Researcher Agent with comprehensive research prompt
(
  '550e8400-e29b-41d4-a716-446655440001',
  '00000000-0000-0000-0000-000000000001', -- Will be replaced with actual user ID
  'AI Researcher',
  'Глубокий исследовательский агент для анализа данных, научных исследований и создания отчетов',
  'Ты - AI Researcher, специализирующийся на проведении глубоких исследований, анализе данных и создании comprehensive отчетов. 

Твои основные навыки:
- Анализ больших объемов информации и выделение ключевых инсайтов
- Структурирование исследований с четкой методологией
- Создание подробных отчетов с выводами и рекомендациями
- Поиск релевантных источников и проверка фактов
- Сравнительный анализ различных точек зрения
- Статистический анализ и интерпретация данных

Твой стиль общения:
- Тщательность и точность в каждом ответе
- Ссылки на источники и данные
- Структурированное представление информации
- Объективность и критическое мышление
- Готовность признать ограничения и неопределенности

При получении запроса на исследование:
1. Определи ключевые аспекты для изучения
2. Предложи методологию исследования
3. Найди и проанализируй релевантные данные
4. Представь результаты в структурированном виде
5. Сделай обоснованные выводы и рекомендации

Всегда стремись к максимальной точности и полноте исследований.',
  'researcher',
  true,
  '[]'::jsonb,
  '{"accuracy": 0.95, "response_time": 2.1, "user_satisfaction": 4.9, "research_depth": 0.92}'::jsonb,
  NOW()
),
-- Support Agent with comprehensive support prompt
(
  '550e8400-e29b-41d4-a716-446655440002',
  '00000000-0000-0000-0000-000000000001', -- Will be replaced with actual user ID
  'Support Specialist',
  'Экспертный агент технической поддержки для решения сложных проблем пользователей',
  'Ты - Support Specialist, опытный агент технической поддержки с глубокими знаниями в различных областях технологий.

Твои основные компетенции:
- Диагностика и решение технических проблем
- Объяснение сложных концепций простым языком
- Пошаговые инструкции по устранению неполадок
- Знание современных технологий и платформ
- Работа с API, базами данных, веб-приложениями
- Безопасность и best practices

Твой подход к поддержке:
- Внимательное выслушивание проблемы пользователя
- Задавание уточняющих вопросов для точной диагностики
- Предоставление четких, пошаговых решений
- Объяснение причин возникновения проблемы
- Рекомендации по предотвращению подобных ситуаций
- Терпеливость и эмпатия к пользователям

Твой стиль общения:
- Дружелюбный и профессиональный тон
- Структурированные ответы с четкими шагами
- Использование примеров и аналогий
- Проверка понимания пользователем
- Готовность предоставить дополнительные объяснения

При получении запроса в поддержку:
1. Внимательно изучи описание проблемы
2. Задай уточняющие вопросы при необходимости
3. Определи наиболее вероятную причину
4. Предложи пошаговое решение
5. Объясни, как избежать проблемы в будущем
6. Убедись, что пользователь понял решение

Всегда стремись не просто решить проблему, но и обучить пользователя.',
  'support',
  true,
  '[]'::jsonb,
  '{"accuracy": 0.91, "response_time": 1.5, "user_satisfaction": 4.7, "resolution_rate": 0.88}'::jsonb,
  NOW()
),
-- Creative Writer Agent
(
  '550e8400-e29b-41d4-a716-446655440003',
  '00000000-0000-0000-0000-000000000001',
  'Creative Writer',
  'Креативный писатель для создания engaging контента и storytelling',
  'Ты - Creative Writer, мастер создания увлекательного контента и storytelling. 

Твои навыки включают:
- Написание статей, блог-постов, и маркетингового контента
- Создание увлекательных историй и нарративов
- Адаптация стиля под различные аудитории
- SEO-оптимизация контента
- Копирайтинг и UX-тексты
- Сценарии и диалоги

Твой творческий процесс:
- Понимание целевой аудитории и цели контента
- Создание compelling hooks и заголовков
- Структурирование контента для максимального engagement
- Использование storytelling techniques
- Балансирование информативности и развлекательности

Всегда создавай контент, который информирует, вдохновляет и мотивирует к действию.',
  'writer',
  true,
  '[]'::jsonb,
  '{"creativity": 0.94, "engagement": 0.89, "response_time": 1.8, "user_satisfaction": 4.6}'::jsonb,
  NOW()
),
-- Code Expert Agent
(
  '550e8400-e29b-41d4-a716-446655440004',
  '00000000-0000-0000-0000-000000000001',
  'Code Expert',
  'Экспертный программист для разработки, review кода и архитектурных решений',
  'Ты - Code Expert, опытный программист с глубокими знаниями современных технологий и best practices.

Твои технические навыки:
- Полнодное программирование (Frontend, Backend, DevOps)
- Code review и архитектурное планирование
- Отладка и оптимизация производительности
- Современные фреймворки и библиотеки
- Паттерны проектирования и clean code
- Тестирование и CI/CD

Языки и технологии:
- JavaScript/TypeScript, React, Node.js
- Python, Django, FastAPI
- SQL и NoSQL базы данных
- Docker, Kubernetes, AWS/GCP
- Git, Testing frameworks

Твой подход к программированию:
- Написание чистого, читаемого кода
- Тщательное тестирование и документация
- Оптимизация для производительности и масштабируемости
- Следование industry standards и best practices
- Continuous learning и адаптация к новым технологиям

Всегда предоставляй практичные, протестированные решения с объяснениями.',
  'coder',
  true,
  '[]'::jsonb,
  '{"code_quality": 0.96, "problem_solving": 0.93, "response_time": 2.3, "user_satisfaction": 4.8}'::jsonb,
  NOW()
);

-- Insert comprehensive test chats
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
-- Research Chat with documents
(
  '550e8400-e29b-41d4-a716-446655440010',
  '00000000-0000-0000-0000-000000000001',
  'AI & Machine Learning Research',
  'rag',
  ARRAY['550e8400-e29b-41d4-a716-446655440001'],
  ARRAY['550e8400-e29b-41d4-a716-446655440020'],
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '30 minutes'
),
-- Support Chat
(
  '550e8400-e29b-41d4-a716-446655440011',
  '00000000-0000-0000-0000-000000000001',
  'Technical Support Session',
  'support',
  ARRAY['550e8400-e29b-41d4-a716-446655440002'],
  ARRAY[]::uuid[],
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '15 minutes'
),
-- Multi-Agent Creative Session
(
  '550e8400-e29b-41d4-a716-446655440012',
  '00000000-0000-0000-0000-000000000001',
  'Creative Content Strategy',
  'multi_agent',
  ARRAY['550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001'],
  ARRAY[]::uuid[],
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '45 minutes'
),
-- Code Review Chat
(
  '550e8400-e29b-41d4-a716-446655440013',
  '00000000-0000-0000-0000-000000000001',
  'React Architecture Review',
  'general',
  ARRAY['550e8400-e29b-41d4-a716-446655440004'],
  ARRAY[]::uuid[],
  NOW() - INTERVAL '4 hours',
  NOW() - INTERVAL '1 hour'
);

-- Insert test documents with comprehensive content
INSERT INTO public.documents (
  id,
  user_id,
  file_name,
  storage_path,
  pages,
  meta,
  created_at
) VALUES 
-- Comprehensive AI Research Document
(
  '550e8400-e29b-41d4-a716-446655440020',
  '00000000-0000-0000-0000-000000000001',
  'Complete_AI_ML_Guide_2024.pdf',
  'documents/ai_ml_guide_2024.pdf',
  45,
  '{
    "file_size": 5242880,
    "author": "AI Research Institute",
    "subject": "Artificial Intelligence and Machine Learning",
    "keywords": ["AI", "machine learning", "deep learning", "neural networks", "transformers", "LLM"],
    "upload_date": "2024-01-15",
    "language": "en",
    "document_type": "research_guide"
  }'::jsonb,
  NOW() - INTERVAL '1 week'
),
-- Technical Documentation
(
  '550e8400-e29b-41d4-a716-446655440021',
  '00000000-0000-0000-0000-000000000001',
  'React_Best_Practices_2024.pdf',
  'documents/react_best_practices.pdf',
  28,
  '{
    "file_size": 3145728,
    "author": "Frontend Masters",
    "subject": "React Development",
    "keywords": ["React", "JavaScript", "frontend", "components", "hooks"],
    "upload_date": "2024-01-10",
    "language": "en",
    "document_type": "technical_guide"
  }'::jsonb,
  NOW() - INTERVAL '5 days'
);

-- Insert comprehensive document chunks with realistic embeddings
INSERT INTO public.document_chunks (
  id,
  document_id,
  content,
  embedding,
  page_number,
  chunk_index,
  created_at
) VALUES 
-- AI/ML Guide chunks
(
  '550e8400-e29b-41d4-a716-446655440030',
  '550e8400-e29b-41d4-a716-446655440020',
  'Introduction to Artificial Intelligence and Machine Learning

Artificial Intelligence (AI) has evolved from a theoretical concept to a practical technology that powers many applications we use daily. Machine Learning (ML), a subset of AI, enables computers to learn and improve from experience without being explicitly programmed for every task.

The field has seen remarkable progress with the development of deep learning architectures, particularly transformer models that have revolutionized natural language processing. Large Language Models (LLMs) like GPT, BERT, and their variants have demonstrated unprecedented capabilities in understanding and generating human-like text.

Key developments in 2024 include:
- Multimodal AI systems that can process text, images, and audio
- More efficient training techniques reducing computational costs
- Improved safety measures and alignment techniques
- Integration of AI into enterprise workflows and consumer applications',
  '[0.1, 0.2, 0.15, 0.3, 0.25, 0.18, 0.22, 0.19, 0.28, 0.16]'::vector,
  1,
  0,
  NOW() - INTERVAL '1 week'
),
(
  '550e8400-e29b-41d4-a716-446655440031',
  '550e8400-e29b-41d4-a716-446655440020',
  'Machine Learning Fundamentals and Algorithms

Machine Learning can be categorized into three main types: supervised learning, unsupervised learning, and reinforcement learning. Each approach serves different purposes and is suitable for various problem domains.

Supervised Learning involves training models on labeled data to make predictions. Common algorithms include:
- Linear and Logistic Regression for simple predictive tasks
- Decision Trees and Random Forests for interpretable models
- Support Vector Machines for classification problems
- Neural Networks for complex pattern recognition

Unsupervised Learning discovers hidden patterns in unlabeled data:
- Clustering algorithms like K-means and hierarchical clustering
- Dimensionality reduction techniques like PCA and t-SNE
- Association rule learning for market basket analysis

Reinforcement Learning trains agents to make decisions through interaction with an environment, optimizing long-term rewards. This approach has been successful in game playing, robotics, and autonomous systems.',
  '[0.25, 0.18, 0.32, 0.12, 0.29, 0.21, 0.26, 0.17, 0.31, 0.23]'::vector,
  2,
  0,
  NOW() - INTERVAL '1 week'
),
(
  '550e8400-e29b-41d4-a716-446655440032',
  '550e8400-e29b-41d4-a716-446655440020',
  'Deep Learning and Neural Network Architectures

Deep Learning has transformed the AI landscape with its ability to automatically learn hierarchical representations from raw data. Neural networks with multiple hidden layers can capture complex patterns that traditional machine learning algorithms might miss.

Convolutional Neural Networks (CNNs) excel at image processing tasks:
- Image classification and object detection
- Medical image analysis and diagnostic assistance
- Computer vision applications in autonomous vehicles

Recurrent Neural Networks (RNNs) and their variants handle sequential data:
- Long Short-Term Memory (LSTM) networks for time series prediction
- Gated Recurrent Units (GRUs) for more efficient sequence modeling
- Applications in natural language processing and speech recognition

Transformer Architecture has revolutionized NLP:
- Self-attention mechanisms for parallel processing
- BERT for bidirectional context understanding
- GPT models for generative language tasks
- Vision Transformers adapting the architecture for image processing',
  '[0.31, 0.19, 0.27, 0.24, 0.33, 0.16, 0.28, 0.22, 0.30, 0.20]'::vector,
  5,
  0,
  NOW() - INTERVAL '1 week'
),
-- React Guide chunks
(
  '550e8400-e29b-41d4-a716-446655440033',
  '550e8400-e29b-41d4-a716-446655440021',
  'React Best Practices and Modern Development Patterns

React has evolved significantly since its introduction, with modern development patterns emphasizing functional components, hooks, and improved performance optimization. Following established best practices ensures maintainable, scalable applications.

Component Design Principles:
- Single Responsibility: Each component should have one clear purpose
- Composition over Inheritance: Use component composition for reusability
- Props Interface: Define clear, typed interfaces for component props
- Controlled vs Uncontrolled Components: Choose appropriate patterns for form handling

State Management Best Practices:
- Use local state for component-specific data
- Lift state up when multiple components need access
- Consider Context API for application-wide state
- Implement Redux or Zustand for complex state logic
- Avoid prop drilling with proper state architecture',
  '[0.22, 0.35, 0.18, 0.29, 0.26, 0.31, 0.17, 0.33, 0.24, 0.28]'::vector,
  1,
  0,
  NOW() - INTERVAL '5 days'
),
(
  '550e8400-e29b-41d4-a716-446655440034',
  '550e8400-e29b-41d4-a716-446655440021',
  'React Hooks and Performance Optimization

React Hooks have transformed how we write React applications, enabling stateful logic in functional components and providing powerful optimization opportunities.

Essential Hooks for Modern React:
- useState for local component state management
- useEffect for side effects and lifecycle methods
- useContext for consuming context values
- useReducer for complex state logic
- useMemo for expensive computations
- useCallback for function memoization
- Custom hooks for reusable stateful logic

Performance Optimization Strategies:
- React.memo for preventing unnecessary re-renders
- Code splitting with React.lazy and Suspense
- Virtual scrolling for large lists
- Image optimization and lazy loading
- Bundle analysis and tree shaking
- Proper key usage in lists
- Avoiding inline objects and functions in JSX',
  '[0.28, 0.21, 0.34, 0.16, 0.30, 0.25, 0.19, 0.32, 0.27, 0.23]'::vector,
  8,
  0,
  NOW() - INTERVAL '5 days'
);

-- Insert realistic test messages across different chats
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
-- Research Chat Messages
(
  '550e8400-e29b-41d4-a716-446655440040',
  '550e8400-e29b-41d4-a716-446655440010',
  'user',
  'Мне нужно провести comprehensive анализ современного состояния машинного обучения. Особенно интересуют последние достижения в области transformer архитектур и their applications.',
  'user',
  NULL,
  'research_request',
  0.96,
  '{}'::jsonb,
  'gpt-4o-mini',
  'text',
  NOW() - INTERVAL '2 hours'
),
(
  '550e8400-e29b-41d4-a716-446655440041',
  '550e8400-e29b-41d4-a716-446655440010',
  'AI Researcher',
  'Отличный исследовательский запрос! Я проведу comprehensive анализ современного состояния ML с акцентом на transformer архитектуры.

**Текущее состояние Machine Learning (2024)**

На основе анализа последних исследований, могу выделить ключевые тренды:

**1. Transformer Revolution**
- Архитектура трансформеров стала доминирующей не только в NLP, но и в computer vision
- Vision Transformers (ViTs) показывают remarkable результаты в image classification
- Multimodal transformers объединяют text, image, и audio processing

**2. Large Language Models Evolution** 
- Развитие в сторону более efficient training methods
- Improved alignment techniques для безопасности
- Specialized models для domain-specific задач

**3. Key Technical Advances**
- Self-attention mechanisms с improved computational efficiency
- Better positional encoding methods
- Advanced fine-tuning techniques (LoRA, QLoRA)

Хотели бы углубиться в какой-то specific аспект этого анализа?',
  'assistant',
  '550e8400-e29b-41d4-a716-446655440001',
  'research_response',
  0.94,
  '{"research_depth": "comprehensive", "sources_consulted": 15}'::jsonb,
  'gpt-4o-mini',
  'text',
  NOW() - INTERVAL '2 hours' + INTERVAL '5 minutes'
),
-- Support Chat Messages
(
  '550e8400-e29b-41d4-a716-446655440042',
  '550e8400-e29b-41d4-a716-446655440011',
  'user',
  'У меня проблема с deployment React приложения. После build процесс deployment fails с ошибкой "Module not found". В dev mode всё работает perfectly.',
  'user',
  NULL,
  'technical_support',
  0.98,
  '{}'::jsonb,
  'gpt-4o-mini',
  'text',
  NOW() - INTERVAL '1 hour'
),
(
  '550e8400-e29b-41d4-a716-446655440043',
  '550e8400-e29b-41d4-a716-446655440011',
  'Support Specialist',
  'Понимаю вашу проблему! "Module not found" errors при deployment, когда dev mode работает, обычно связаны с несколькими common issues. Давайте диагностируем пошагово:

**Первичная диагностика:**

1. **Case Sensitivity Issues**
   - Проверьте import paths на точное соответствие file names
   - Linux/production environments чувствительны к регистру
   - Пример: `import Component from \'./component\'` vs `./Component`

2. **Path Resolution Problems**
   - Убедитесь, что все relative paths корректны
   - Проверьте tsconfig.json/jsconfig.json path mappings
   - Verify webpack/vite configuration

3. **Dependencies Issues**
   - Все ли dependencies в package.json (не только devDependencies)?
   - Запустите `npm ls` для проверки missing packages

**Immediate Action Steps:**
1. Поделитесь exact error message
2. Проверьте build logs на specific missing module
3. Verify package.json dependencies

Какой именно module не найден? Это поможет точнее диагностировать проблему.',
  'assistant',
  '550e8400-e29b-41d4-a716-446655440002',
  'technical_support',
  0.92,
  '{"diagnostic_steps": 3, "solution_confidence": 0.89}'::jsonb,
  'gpt-4o-mini',
  'text',
  NOW() - INTERVAL '1 hour' + INTERVAL '3 minutes'
),
-- Multi-Agent Creative Session
(
  '550e8400-e29b-41d4-a716-446655440044',
  '550e8400-e29b-41d4-a716-446655440012',
  'user',
  'Нужно создать content strategy для tech startup в области AI. Target audience - enterprise clients. Требуется comprehensive approach включающий blog content, case studies, и thought leadership материалы.',
  'user',
  NULL,
  'creative_request',
  0.93,
  '{}'::jsonb,
  'gpt-4o-mini',
  'text',
  NOW() - INTERVAL '3 hours'
),
-- Code Review Chat
(
  '550e8400-e29b-41d4-a716-446655440045',
  '550e8400-e29b-41d4-a716-446655440013',
  'user',
  'Можешь review мою React component architecture? Особенно интересует state management approach и performance optimization strategies для large application.',
  'user',
  NULL,
  'code_review',
  0.91,
  '{}'::jsonb,
  'gpt-4o-mini',
  'text',
  NOW() - INTERVAL '4 hours'
);

-- Insert agent conversations for multi-agent chat
INSERT INTO public.agent_conversations (
  id,
  chat_id,
  agent_ids,
  conversation_state,
  created_at,
  updated_at
) VALUES 
(
  '550e8400-e29b-41d4-a716-446655440050',
  '550e8400-e29b-41d4-a716-446655440012',
  ARRAY['550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001'],
  '{
    "currentTurn": 3,
    "maxTurns": 5,
    "agents": ["550e8400-e29b-41d4-a716-446655440003", "550e8400-e29b-41d4-a716-446655440001"],
    "topic": "AI Tech Startup Content Strategy",
    "status": "active",
    "messages": [
      {
        "agentId": "550e8400-e29b-41d4-a716-446655440003",
        "agentName": "Creative Writer",
        "content": "Для tech startup в AI сфере нужна multi-layered content strategy. Предлагаю focus на thought leadership и practical value demonstration.",
        "timestamp": "2024-01-01T14:00:00Z",
        "reasoning": "Creative angle for enterprise AI content"
      },
      {
        "agentId": "550e8400-e29b-41d4-a716-446655440001",
        "agentName": "AI Researcher", 
        "content": "Согласен с creative approach. С research perspective, важно включить data-driven insights и case studies показывающие measurable ROI.",
        "timestamp": "2024-01-01T14:02:00Z",
        "reasoning": "Research-backed content validation"
      },
      {
        "agentId": "550e8400-e29b-41d4-a716-446655440003",
        "agentName": "Creative Writer",
        "content": "Отличная идея! Комбинируем storytelling с hard data. Структурируем content pillar вокруг: Problem → Solution → Proof → Implementation.",
        "timestamp": "2024-01-01T14:05:00Z",
        "reasoning": "Structured content framework"
      }
    ]
  }'::jsonb,
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '45 minutes'
);

-- Insert comprehensive intent classifications
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
  '550e8400-e29b-41d4-a716-446655440060',
  '550e8400-e29b-41d4-a716-446655440040',
  'research_request',
  0.96,
  '550e8400-e29b-41d4-a716-446655440001',
  'User requesting comprehensive ML analysis with focus on transformer architectures - clearly research intent',
  NOW() - INTERVAL '2 hours'
),
(
  '550e8400-e29b-41d4-a716-446655440061',
  '550e8400-e29b-41d4-a716-446655440042',
  'technical_support',
  0.98,
  '550e8400-e29b-41d4-a716-446655440002',
  'User reporting deployment issue with specific technical problem - clear support request',
  NOW() - INTERVAL '1 hour'
),
(
  '550e8400-e29b-41d4-a716-446655440062',
  '550e8400-e29b-41d4-a716-446655440044',
  'creative_request',
  0.93,
  '550e8400-e29b-41d4-a716-446655440003',
  'User requesting content strategy development - creative and strategic task',
  NOW() - INTERVAL '3 hours'
),
(
  '550e8400-e29b-41d4-a716-446655440063',
  '550e8400-e29b-41d4-a716-446655440045',
  'code_review',
  0.91,
  '550e8400-e29b-41d4-a716-446655440004',
  'User requesting code architecture review - technical code evaluation task',
  NOW() - INTERVAL '4 hours'
);

-- Create optimized indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_agent ON public.messages(chat_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_intent_confidence ON public.messages(intent, confidence);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON public.document_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_agents_role_active ON public.agents(role, is_active);
CREATE INDEX IF NOT EXISTS idx_chats_type_updated ON public.chats(chat_type, updated_at);

-- Update statistics for query optimization
ANALYZE public.agents;
ANALYZE public.chats;
ANALYZE public.messages;
ANALYZE public.documents;
ANALYZE public.document_chunks;
ANALYZE public.agent_conversations;
ANALYZE public.intent_classifications;

-- Create helpful views for common queries
CREATE OR REPLACE VIEW active_agents_with_metrics AS
SELECT 
  a.*,
  (a.performance_metrics->>'accuracy')::numeric as accuracy,
  (a.performance_metrics->>'response_time')::numeric as response_time,
  (a.performance_metrics->>'user_satisfaction')::numeric as user_satisfaction
FROM public.agents a
WHERE a.is_active = true;

CREATE OR REPLACE VIEW chat_summaries AS
SELECT 
  c.*,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at,
  ARRAY_AGG(DISTINCT m.intent) FILTER (WHERE m.intent IS NOT NULL) as detected_intents
FROM public.chats c
LEFT JOIN public.messages m ON c.id = m.chat_id
GROUP BY c.id;

-- Comment for documentation
COMMENT ON TABLE public.agents IS 'AI agents with comprehensive prompts and performance tracking';
COMMENT ON TABLE public.agent_conversations IS 'Multi-agent conversation state and history';
COMMENT ON TABLE public.intent_classifications IS 'Intent detection results for automatic routing';
COMMENT ON VIEW active_agents_with_metrics IS 'Active agents with extracted performance metrics';
COMMENT ON VIEW chat_summaries IS 'Chat overview with message counts and intent analysis';
