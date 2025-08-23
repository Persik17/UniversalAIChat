-- Support Automation Infrastructure
-- Tables for automated support ticket creation, routing, and escalation

-- Support Tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('technical', 'billing', 'general', 'feature_request', 'bug_report')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')) DEFAULT 'open',
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  estimated_resolution_time INTEGER, -- in minutes
  actual_resolution_time INTEGER, -- in minutes
  requires_escalation BOOLEAN DEFAULT false,
  escalated_at TIMESTAMP WITH TIME ZONE,
  escalation_reason TEXT,
  customer_satisfaction_score INTEGER CHECK (customer_satisfaction_score >= 1 AND customer_satisfaction_score <= 5),
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent Assignments Table
CREATE TABLE IF NOT EXISTS public.agent_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  assignment_reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'transferred')) DEFAULT 'active',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  transfer_reason TEXT,
  transferred_to UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  performance_score DECIMAL(3,2), -- Agent performance on this assignment
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Support Escalations Table
CREATE TABLE IF NOT EXISTS public.support_escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  to_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  escalation_type TEXT NOT NULL CHECK (escalation_type IN ('complexity', 'priority', 'timeout', 'manual')),
  reason TEXT NOT NULL,
  additional_context JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Support Knowledge Base Table (for automated responses)
CREATE TABLE IF NOT EXISTS public.support_knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  intent_patterns TEXT[] DEFAULT ARRAY[]::TEXT[],
  auto_response_template TEXT,
  confidence_threshold DECIMAL(3,2) DEFAULT 0.8,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Support Metrics Tracking Table
CREATE TABLE IF NOT EXISTS public.support_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  metric_type TEXT NOT NULL, -- 'tickets_created', 'tickets_resolved', 'avg_resolution_time', etc.
  metric_value DECIMAL(10,2) NOT NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  category TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Views for Support Analytics
CREATE OR REPLACE VIEW public.support_dashboard AS
SELECT 
  DATE(st.created_at) as date,
  COUNT(*) as total_tickets,
  COUNT(CASE WHEN st.status = 'resolved' THEN 1 END) as resolved_tickets,
  COUNT(CASE WHEN st.status = 'open' THEN 1 END) as open_tickets,
  COUNT(CASE WHEN st.priority = 'urgent' THEN 1 END) as urgent_tickets,
  AVG(st.actual_resolution_time) as avg_resolution_time,
  AVG(st.customer_satisfaction_score) as avg_satisfaction
FROM public.support_tickets st
GROUP BY DATE(st.created_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW public.agent_performance_summary AS
SELECT 
  a.id as agent_id,
  a.name as agent_name,
  COUNT(st.id) as total_tickets,
  COUNT(CASE WHEN st.status = 'resolved' THEN 1 END) as resolved_tickets,
  AVG(st.actual_resolution_time) as avg_resolution_time,
  AVG(st.customer_satisfaction_score) as avg_satisfaction,
  COUNT(se.id) as escalations_received,
  AVG(aa.performance_score) as avg_performance_score
FROM public.agents a
LEFT JOIN public.support_tickets st ON a.id = st.agent_id
LEFT JOIN public.support_escalations se ON a.id = se.to_agent_id
LEFT JOIN public.agent_assignments aa ON a.id = aa.agent_id
WHERE a.is_active = true
GROUP BY a.id, a.name;

-- Enable Row Level Security
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
CREATE POLICY "Users can view their own support tickets" ON public.support_tickets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create support tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Agents can view assigned tickets" ON public.support_tickets
  FOR SELECT USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agents can update assigned tickets" ON public.support_tickets
  FOR UPDATE USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for agent_assignments
CREATE POLICY "Users can view assignments for their chats" ON public.agent_assignments
  FOR SELECT USING (
    chat_id IN (
      SELECT id FROM public.chats WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agents can view their assignments" ON public.agent_assignments
  FOR SELECT USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for support_knowledge_base
CREATE POLICY "Everyone can read knowledge base" ON public.support_knowledge_base
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can manage their knowledge base entries" ON public.support_knowledge_base
  FOR ALL USING (created_by = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_agent_id ON public.support_tickets(agent_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);

CREATE INDEX IF NOT EXISTS idx_agent_assignments_chat_agent ON public.agent_assignments(chat_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_assignments_status ON public.agent_assignments(status);

CREATE INDEX IF NOT EXISTS idx_support_escalations_ticket_id ON public.support_escalations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_escalations_type ON public.support_escalations(escalation_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_keywords ON public.support_knowledge_base USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON public.support_knowledge_base(category);

CREATE INDEX IF NOT EXISTS idx_support_metrics_date_type ON public.support_metrics(date, metric_type);
CREATE INDEX IF NOT EXISTS idx_support_metrics_agent_id ON public.support_metrics(agent_id);

-- Triggers for updated_at
CREATE TRIGGER update_support_tickets_updated_at 
    BEFORE UPDATE ON public.support_tickets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_assignments_updated_at 
    BEFORE UPDATE ON public.agent_assignments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_knowledge_base_updated_at 
    BEFORE UPDATE ON public.support_knowledge_base 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically assign agents based on workload
CREATE OR REPLACE FUNCTION auto_assign_agent_by_workload(
  p_category TEXT,
  p_priority TEXT
) RETURNS UUID AS $$
DECLARE
  selected_agent_id UUID;
BEGIN
  -- Find agent with least current workload in the category
  SELECT a.id INTO selected_agent_id
  FROM public.agents a
  LEFT JOIN public.support_tickets st ON a.id = st.agent_id AND st.status IN ('open', 'in_progress')
  WHERE a.is_active = true
    AND (a.role = 'support' OR a.role = 'assistant')
  GROUP BY a.id, a.name
  ORDER BY COUNT(st.id) ASC, RANDOM() -- Load balancing with randomization
  LIMIT 1;
  
  RETURN selected_agent_id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-escalate tickets based on conditions
CREATE OR REPLACE FUNCTION check_auto_escalation()
RETURNS TRIGGER AS $$
DECLARE
  escalation_needed BOOLEAN := false;
  escalation_reason TEXT := '';
BEGIN
  -- Check if escalation is needed based on various conditions
  
  -- Time-based escalation
  IF NEW.priority = 'urgent' AND NEW.created_at < NOW() - INTERVAL '30 minutes' AND NEW.status = 'open' THEN
    escalation_needed := true;
    escalation_reason := 'Urgent ticket not addressed within 30 minutes';
  ELSIF NEW.priority = 'high' AND NEW.created_at < NOW() - INTERVAL '2 hours' AND NEW.status = 'open' THEN
    escalation_needed := true;
    escalation_reason := 'High priority ticket not addressed within 2 hours';
  END IF;
  
  -- Complexity-based escalation
  IF NEW.requires_escalation = true AND NEW.escalated_at IS NULL THEN
    escalation_needed := true;
    escalation_reason := 'Ticket marked for escalation due to complexity';
  END IF;
  
  -- Create escalation if needed
  IF escalation_needed THEN
    INSERT INTO public.support_escalations (
      ticket_id,
      from_agent_id,
      escalation_type,
      reason
    ) VALUES (
      NEW.id,
      NEW.agent_id,
      'timeout',
      escalation_reason
    );
    
    -- Update ticket
    NEW.escalated_at := NOW();
    NEW.escalation_reason := escalation_reason;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-escalation
CREATE TRIGGER auto_escalation_trigger
    BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION check_auto_escalation();

-- Insert initial knowledge base entries
INSERT INTO public.support_knowledge_base (
  title,
  content,
  category,
  keywords,
  intent_patterns,
  auto_response_template
) VALUES 
(
  'Проблемы с загрузкой файлов',
  'Стандартные шаги для решения проблем с загрузкой: 1) Проверить размер файла (максимум 10MB), 2) Проверить формат файла, 3) Очистить кэш браузера, 4) Попробовать другой браузер',
  'technical',
  ARRAY['загрузка', 'файл', 'upload', 'file'],
  ARRAY['не могу загрузить', 'проблема с загрузкой', 'upload fails'],
  'Давайте решим проблему с загрузкой файла. Сначала проверьте: 1) Размер файла не превышает 10MB, 2) Файл в поддерживаемом формате, 3) Стабильность интернет-соединения.'
),
(
  'Медленная работа системы',
  'Оптимизация производительности: 1) Перезагрузить страницу, 2) Проверить интернет-соединение, 3) Очистить кэш, 4) Закрыть ненужные вкладки',
  'technical',
  ARRAY['медленно', 'тормозит', 'slow', 'performance'],
  ARRAY['медленно работает', 'система тормозит', 'slow performance'],
  'Понимаю, что система работает медленно. Попробуйте следующие шаги: 1) Обновите страницу (F5), 2) Проверьте скорость интернета, 3) Закройте лишние вкладки браузера.'
);

-- Insert sample support tickets for testing
INSERT INTO public.support_tickets (
  chat_id,
  title,
  description,
  category,
  priority,
  agent_id,
  estimated_resolution_time,
  user_id
) VALUES 
(
  '550e8400-e29b-41d4-a716-446655440011', -- Technical Support chat
  'Проблема с deployment React приложения',
  'У меня проблема с deployment React приложения. После build процесс deployment fails с ошибкой "Module not found". В dev mode всё работает perfectly.',
  'technical',
  'medium',
  '550e8400-e29b-41d4-a716-446655440002', -- Support Agent
  60,
  '00000000-0000-0000-0000-000000000001'
);

-- Comments for documentation
COMMENT ON TABLE public.support_tickets IS 'Automated support ticket management with classification and routing';
COMMENT ON TABLE public.agent_assignments IS 'Agent assignment tracking with performance metrics';
COMMENT ON TABLE public.support_escalations IS 'Escalation management for complex or overdue tickets';
COMMENT ON TABLE public.support_knowledge_base IS 'Knowledge base for automated responses and agent assistance';
COMMENT ON VIEW public.support_dashboard IS 'Real-time support metrics dashboard';
COMMENT ON VIEW public.agent_performance_summary IS 'Agent performance analytics and KPIs';
COMMENT ON FUNCTION auto_assign_agent_by_workload(TEXT, TEXT) IS 'Automatically assigns agents based on current workload';
COMMENT ON FUNCTION check_auto_escalation() IS 'Automatically escalates tickets based on time and complexity criteria';
