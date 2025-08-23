-- Context Switching Infrastructure
-- Tables and functions for automatic context switching based on conversation flow

-- Context Switches Table (for logging and analytics)
CREATE TABLE IF NOT EXISTS public.context_switches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  from_context TEXT NOT NULL CHECK (from_context IN ('general', 'rag', 'history', 'agent', 'support')),
  to_context TEXT NOT NULL CHECK (to_context IN ('general', 'rag', 'history', 'agent', 'support')),
  trigger_message TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'automatic' CHECK (trigger_type IN ('automatic', 'manual', 'fallback')),
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  success BOOLEAN,
  user_feedback INTEGER CHECK (user_feedback >= 1 AND user_feedback <= 5),
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation Context Sessions Table
CREATE TABLE IF NOT EXISTS public.conversation_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL CHECK (context_type IN ('general', 'rag', 'history', 'agent', 'support')),
  active_documents UUID[] DEFAULT ARRAY[]::UUID[],
  relevant_messages UUID[] DEFAULT ARRAY[]::UUID[],
  assigned_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  context_score DECIMAL(3,2) DEFAULT 0.5,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  effectiveness_score DECIMAL(3,2),
  user_satisfaction INTEGER CHECK (user_satisfaction >= 1 AND user_satisfaction <= 5),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Context Triggers Table (for defining automatic context switching rules)
CREATE TABLE IF NOT EXISTS public.context_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_keywords TEXT[] NOT NULL,
  trigger_patterns TEXT[] DEFAULT ARRAY[]::TEXT[],
  source_context TEXT CHECK (source_context IN ('general', 'rag', 'history', 'agent', 'support')),
  target_context TEXT NOT NULL CHECK (target_context IN ('general', 'rag', 'history', 'agent', 'support')),
  confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
  cooldown_minutes INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Context Analytics View
CREATE OR REPLACE VIEW public.context_analytics AS
SELECT 
  DATE(cs.created_at) as date,
  cs.from_context,
  cs.to_context,
  COUNT(*) as switch_count,
  AVG(cs.confidence) as avg_confidence,
  COUNT(CASE WHEN cs.success = true THEN 1 END) as successful_switches,
  AVG(cs.user_feedback) as avg_user_feedback,
  AVG(EXTRACT(EPOCH FROM (cc.session_end - cc.session_start))/60) as avg_session_duration_minutes
FROM public.context_switches cs
LEFT JOIN public.conversation_contexts cc ON cs.chat_id = cc.chat_id 
  AND cc.context_type = cs.to_context
GROUP BY DATE(cs.created_at), cs.from_context, cs.to_context
ORDER BY date DESC, switch_count DESC;

-- Context Effectiveness View
CREATE OR REPLACE VIEW public.context_effectiveness AS
SELECT 
  cc.context_type,
  COUNT(*) as total_sessions,
  AVG(cc.effectiveness_score) as avg_effectiveness,
  AVG(cc.user_satisfaction) as avg_satisfaction,
  AVG(EXTRACT(EPOCH FROM (cc.session_end - cc.session_start))/60) as avg_duration_minutes,
  COUNT(CASE WHEN cc.effectiveness_score > 0.7 THEN 1 END) as high_effectiveness_count
FROM public.conversation_contexts cc
WHERE cc.session_end IS NOT NULL
GROUP BY cc.context_type
ORDER BY avg_effectiveness DESC;

-- Enable Row Level Security
ALTER TABLE public.context_switches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.context_triggers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for context_switches
CREATE POLICY "Users can view their context switches" ON public.context_switches
  FOR SELECT USING (
    chat_id IN (
      SELECT id FROM public.chats WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create context switches" ON public.context_switches
  FOR INSERT WITH CHECK (
    chat_id IN (
      SELECT id FROM public.chats WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for conversation_contexts
CREATE POLICY "Users can view their conversation contexts" ON public.conversation_contexts
  FOR SELECT USING (
    chat_id IN (
      SELECT id FROM public.chats WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their conversation contexts" ON public.conversation_contexts
  FOR ALL USING (
    chat_id IN (
      SELECT id FROM public.chats WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for context_triggers
CREATE POLICY "Users can view active triggers" ON public.context_triggers
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can manage their triggers" ON public.context_triggers
  FOR ALL USING (created_by = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_context_switches_chat_id ON public.context_switches(chat_id);
CREATE INDEX IF NOT EXISTS idx_context_switches_contexts ON public.context_switches(from_context, to_context);
CREATE INDEX IF NOT EXISTS idx_context_switches_created_at ON public.context_switches(created_at);

CREATE INDEX IF NOT EXISTS idx_conversation_contexts_chat_id ON public.conversation_contexts(chat_id);
CREATE INDEX IF NOT EXISTS idx_conversation_contexts_type ON public.conversation_contexts(context_type);
CREATE INDEX IF NOT EXISTS idx_conversation_contexts_active ON public.conversation_contexts(session_start, session_end);

CREATE INDEX IF NOT EXISTS idx_context_triggers_active ON public.context_triggers(is_active);
CREATE INDEX IF NOT EXISTS idx_context_triggers_keywords ON public.context_triggers USING GIN(trigger_keywords);
CREATE INDEX IF NOT EXISTS idx_context_triggers_target ON public.context_triggers(target_context);

-- Triggers for updated_at
CREATE TRIGGER update_context_switches_updated_at 
    BEFORE UPDATE ON public.context_switches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_contexts_updated_at 
    BEFORE UPDATE ON public.conversation_contexts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_context_triggers_updated_at 
    BEFORE UPDATE ON public.context_triggers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically detect context switching opportunities
CREATE OR REPLACE FUNCTION detect_context_switch_opportunity(
  p_message TEXT,
  p_chat_id UUID,
  p_current_context TEXT DEFAULT 'general'
) RETURNS TABLE (
  should_switch BOOLEAN,
  target_context TEXT,
  confidence DECIMAL(3,2),
  trigger_reason TEXT,
  suggested_documents UUID[],
  suggested_agent UUID
) AS $$
DECLARE
  message_lower TEXT := LOWER(p_message);
  trigger_record RECORD;
  doc_keywords TEXT[] := ARRAY['документ', 'файл', 'pdf', 'document', 'file', 'поиск по'];
  history_keywords TEXT[] := ARRAY['раньше', 'ранее', 'помните', 'previously', 'earlier', 'обсуждали'];
  agent_keywords TEXT[] := ARRAY['специалист', 'эксперт', 'expert', 'specialist', 'помочь с'];
  support_keywords TEXT[] := ARRAY['проблема', 'ошибка', 'помогите', 'problem', 'error', 'help'];
  max_confidence DECIMAL(3,2) := 0;
  best_target_context TEXT := p_current_context;
  best_reason TEXT := 'No context switch needed';
BEGIN
  should_switch := false;
  target_context := p_current_context;
  confidence := 0.5;
  trigger_reason := 'No suitable trigger found';
  suggested_documents := ARRAY[]::UUID[];
  suggested_agent := NULL;

  -- Check for document/RAG context
  IF EXISTS (SELECT 1 FROM unnest(doc_keywords) AS keyword WHERE message_lower LIKE '%' || keyword || '%') THEN
    IF p_current_context != 'rag' THEN
      should_switch := true;
      target_context := 'rag';
      confidence := 0.8;
      trigger_reason := 'Message contains document-related keywords';
      
      -- Find relevant documents
      SELECT ARRAY_AGG(d.id) INTO suggested_documents
      FROM public.documents d
      JOIN public.chats c ON c.user_id = d.user_id
      WHERE c.id = p_chat_id
      LIMIT 3;
    END IF;
  END IF;

  -- Check for history context
  IF EXISTS (SELECT 1 FROM unnest(history_keywords) AS keyword WHERE message_lower LIKE '%' || keyword || '%') THEN
    IF p_current_context != 'history' AND confidence < 0.75 THEN
      should_switch := true;
      target_context := 'history';
      confidence := 0.75;
      trigger_reason := 'Message references conversation history';
    END IF;
  END IF;

  -- Check for agent specialization
  IF EXISTS (SELECT 1 FROM unnest(agent_keywords) AS keyword WHERE message_lower LIKE '%' || keyword || '%') THEN
    IF p_current_context != 'agent' AND confidence < 0.7 THEN
      should_switch := true;
      target_context := 'agent';
      confidence := 0.7;
      trigger_reason := 'Message requires specialized agent assistance';
      
      -- Find suitable agent based on message content
      SELECT a.id INTO suggested_agent
      FROM public.agents a
      WHERE a.is_active = true
        AND (
          (message_lower LIKE '%код%' OR message_lower LIKE '%code%') AND a.role = 'coder'
          OR (message_lower LIKE '%исследован%' OR message_lower LIKE '%research%') AND a.role = 'researcher'
          OR (message_lower LIKE '%поддержк%' OR message_lower LIKE '%support%') AND a.role = 'support'
        )
      LIMIT 1;
    END IF;
  END IF;

  -- Check for support context
  IF EXISTS (SELECT 1 FROM unnest(support_keywords) AS keyword WHERE message_lower LIKE '%' || keyword || '%') THEN
    IF p_current_context != 'support' AND confidence < 0.85 THEN
      should_switch := true;
      target_context := 'support';
      confidence := 0.85;
      trigger_reason := 'Message indicates support request';
      
      -- Find support agent
      SELECT a.id INTO suggested_agent
      FROM public.agents a
      WHERE a.is_active = true AND a.role = 'support'
      ORDER BY RANDOM()
      LIMIT 1;
    END IF;
  END IF;

  -- Check custom triggers
  FOR trigger_record IN 
    SELECT * FROM public.context_triggers 
    WHERE is_active = true 
      AND (source_context IS NULL OR source_context = p_current_context)
    ORDER BY priority DESC
  LOOP
    -- Check if any trigger keywords match
    IF EXISTS (
      SELECT 1 FROM unnest(trigger_record.trigger_keywords) AS keyword 
      WHERE message_lower LIKE '%' || LOWER(keyword) || '%'
    ) THEN
      IF trigger_record.confidence_threshold > confidence THEN
        should_switch := true;
        target_context := trigger_record.target_context;
        confidence := trigger_record.confidence_threshold;
        trigger_reason := 'Custom trigger: ' || trigger_record.name;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT 
    detect_context_switch_opportunity.should_switch,
    detect_context_switch_opportunity.target_context,
    detect_context_switch_opportunity.confidence,
    detect_context_switch_opportunity.trigger_reason,
    detect_context_switch_opportunity.suggested_documents,
    detect_context_switch_opportunity.suggested_agent;
END;
$$ LANGUAGE plpgsql;

-- Function to end current context session and start new one
CREATE OR REPLACE FUNCTION switch_conversation_context(
  p_chat_id UUID,
  p_new_context TEXT,
  p_trigger_reason TEXT,
  p_confidence DECIMAL(3,2),
  p_suggested_documents UUID[] DEFAULT ARRAY[]::UUID[],
  p_suggested_agent UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  current_session_id UUID;
  new_session_id UUID;
  old_context TEXT;
BEGIN
  -- End current active session
  UPDATE public.conversation_contexts 
  SET 
    session_end = NOW(),
    updated_at = NOW()
  WHERE chat_id = p_chat_id 
    AND session_end IS NULL
  RETURNING id, context_type INTO current_session_id, old_context;

  -- Create new context session
  INSERT INTO public.conversation_contexts (
    chat_id,
    context_type,
    active_documents,
    assigned_agent_id,
    context_score,
    metadata
  ) VALUES (
    p_chat_id,
    p_new_context,
    p_suggested_documents,
    p_suggested_agent,
    p_confidence,
    jsonb_build_object(
      'trigger_reason', p_trigger_reason,
      'previous_session_id', current_session_id
    )
  ) RETURNING id INTO new_session_id;

  -- Log the context switch
  INSERT INTO public.context_switches (
    chat_id,
    from_context,
    to_context,
    trigger_message,
    confidence,
    metadata
  ) VALUES (
    p_chat_id,
    COALESCE(old_context, 'general'),
    p_new_context,
    p_trigger_reason,
    p_confidence,
    jsonb_build_object(
      'session_id', new_session_id,
      'suggested_documents', p_suggested_documents,
      'suggested_agent', p_suggested_agent
    )
  );

  RETURN new_session_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default context triggers
INSERT INTO public.context_triggers (
  name,
  description,
  trigger_keywords,
  target_context,
  confidence_threshold,
  priority
) VALUES 
(
  'Document Reference Trigger',
  'Switches to RAG context when user mentions documents',
  ARRAY['документ', 'файл', 'pdf', 'document', 'file', 'в документации', 'найти в'],
  'rag',
  0.8,
  3
),
(
  'History Reference Trigger',
  'Switches to history context when user references past conversation',
  ARRAY['раньше говорили', 'ранее обсуждали', 'помните', 'previously discussed', 'earlier conversation'],
  'history',
  0.75,
  2
),
(
  'Technical Support Trigger',
  'Switches to support context for technical issues',
  ARRAY['проблема', 'ошибка', 'не работает', 'помогите', 'problem', 'error', 'broken', 'help'],
  'support',
  0.85,
  4
),
(
  'Specialized Agent Trigger',
  'Switches to agent context for specialized tasks',
  ARRAY['специалист по', 'эксперт в', 'кто может помочь', 'specialist in', 'expert in', 'консультация'],
  'agent',
  0.7,
  1
);

-- Comments for documentation
COMMENT ON TABLE public.context_switches IS 'Logs all automatic and manual context switches with success metrics';
COMMENT ON TABLE public.conversation_contexts IS 'Tracks active conversation contexts and their effectiveness';
COMMENT ON TABLE public.context_triggers IS 'Configurable rules for automatic context switching';
COMMENT ON VIEW public.context_analytics IS 'Analytics dashboard for context switching patterns';
COMMENT ON VIEW public.context_effectiveness IS 'Effectiveness metrics for different context types';
COMMENT ON FUNCTION detect_context_switch_opportunity(TEXT, UUID, TEXT) IS 'Analyzes message for context switching opportunities';
COMMENT ON FUNCTION switch_conversation_context(UUID, TEXT, TEXT, DECIMAL, UUID[], UUID) IS 'Executes context switch and manages session transitions';
