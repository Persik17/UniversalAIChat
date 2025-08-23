-- Self-Improving Agents Infrastructure
-- Tables for feedback collection and prompt improvement tracking

-- Agent Feedback Table
CREATE TABLE IF NOT EXISTS public.agent_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('correction', 'improvement', 'praise', 'suggestion')),
  original_response TEXT,
  suggested_response TEXT,
  user_feedback TEXT NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompt Improvement Logs Table
CREATE TABLE IF NOT EXISTS public.prompt_improvement_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  old_prompt TEXT NOT NULL,
  new_prompt TEXT NOT NULL,
  improvement_reason TEXT NOT NULL,
  feedback_ids UUID[] DEFAULT ARRAY[]::UUID[],
  performance_before JSONB,
  performance_after JSONB,
  auto_generated BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent Performance Tracking Table
CREATE TABLE IF NOT EXISTS public.agent_performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'accuracy', 'response_time', 'user_satisfaction', etc.
  metric_value DECIMAL(5,4) NOT NULL,
  measurement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  context_data JSONB, -- Additional context about the measurement
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback Aggregation View
CREATE OR REPLACE VIEW public.agent_feedback_summary AS
SELECT 
  a.id as agent_id,
  a.name as agent_name,
  COUNT(af.id) as total_feedback,
  COUNT(CASE WHEN af.feedback_type IN ('correction', 'improvement') THEN 1 END) as negative_feedback,
  COUNT(CASE WHEN af.feedback_type = 'praise' THEN 1 END) as positive_feedback,
  AVG(af.confidence_score) as avg_confidence,
  MAX(af.created_at) as last_feedback_date,
  COUNT(pil.id) as total_improvements
FROM public.agents a
LEFT JOIN public.agent_feedback af ON a.id = af.agent_id
LEFT JOIN public.prompt_improvement_logs pil ON a.id = pil.agent_id
WHERE a.is_active = true
GROUP BY a.id, a.name;

-- Recent Improvements View
CREATE OR REPLACE VIEW public.recent_agent_improvements AS
SELECT 
  pil.*,
  a.name as agent_name,
  a.role as agent_role,
  ARRAY_LENGTH(pil.feedback_ids, 1) as feedback_count
FROM public.prompt_improvement_logs pil
JOIN public.agents a ON pil.agent_id = a.id
ORDER BY pil.created_at DESC;

-- Enable Row Level Security
ALTER TABLE public.agent_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_improvement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_feedback
CREATE POLICY "Users can view feedback for their agents" ON public.agent_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = agent_feedback.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert feedback for their agents" ON public.agent_feedback
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = agent_feedback.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own feedback" ON public.agent_feedback
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own feedback" ON public.agent_feedback
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for prompt_improvement_logs
CREATE POLICY "Users can view improvement logs for their agents" ON public.prompt_improvement_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = prompt_improvement_logs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert improvement logs for their agents" ON public.prompt_improvement_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = prompt_improvement_logs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- RLS Policies for agent_performance_metrics
CREATE POLICY "Users can view performance metrics for their agents" ON public.agent_performance_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = agent_performance_metrics.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert performance metrics for their agents" ON public.agent_performance_metrics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = agent_performance_metrics.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent_id ON public.agent_feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_type_date ON public.agent_feedback(feedback_type, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_confidence ON public.agent_feedback(confidence_score);

CREATE INDEX IF NOT EXISTS idx_prompt_improvement_agent_id ON public.prompt_improvement_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_prompt_improvement_date ON public.prompt_improvement_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent_type ON public.agent_performance_metrics(agent_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_date ON public.agent_performance_metrics(measurement_date);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agent_feedback_updated_at 
    BEFORE UPDATE ON public.agent_feedback 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_improvement_logs_updated_at 
    BEFORE UPDATE ON public.prompt_improvement_logs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically trigger improvement analysis
CREATE OR REPLACE FUNCTION trigger_improvement_analysis()
RETURNS TRIGGER AS $$
DECLARE
    feedback_count INTEGER;
    negative_feedback_ratio DECIMAL;
BEGIN
    -- Count recent feedback for this agent
    SELECT COUNT(*) INTO feedback_count
    FROM public.agent_feedback 
    WHERE agent_id = NEW.agent_id 
    AND created_at > NOW() - INTERVAL '7 days';
    
    -- Calculate negative feedback ratio
    SELECT 
        COUNT(CASE WHEN feedback_type IN ('correction', 'improvement') THEN 1 END)::DECIMAL / 
        COUNT(*)::DECIMAL
    INTO negative_feedback_ratio
    FROM public.agent_feedback 
    WHERE agent_id = NEW.agent_id 
    AND created_at > NOW() - INTERVAL '7 days';
    
    -- Trigger improvement if conditions are met
    IF feedback_count >= 5 AND negative_feedback_ratio > 0.3 THEN
        -- Insert notification or trigger for improvement analysis
        INSERT INTO public.agent_improvement_notifications (
            agent_id, 
            trigger_reason, 
            feedback_count, 
            negative_ratio,
            created_at
        ) VALUES (
            NEW.agent_id,
            'automatic_threshold_reached',
            feedback_count,
            negative_feedback_ratio,
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create notifications table for improvement triggers
CREATE TABLE IF NOT EXISTS public.agent_improvement_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    trigger_reason TEXT NOT NULL,
    feedback_count INTEGER,
    negative_ratio DECIMAL(3,2),
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trigger for automatic improvement analysis
CREATE TRIGGER auto_improvement_analysis_trigger
    AFTER INSERT ON public.agent_feedback
    FOR EACH ROW EXECUTE FUNCTION trigger_improvement_analysis();

-- Insert some example feedback for testing (using the seed agent IDs)
INSERT INTO public.agent_feedback (
    agent_id,
    feedback_type,
    user_feedback,
    confidence_score,
    user_id
) VALUES 
(
    '550e8400-e29b-41d4-a716-446655440001', -- AI Researcher
    'improvement',
    'Ответ был хорошим, но хотелось бы больше конкретных примеров и источников',
    0.75,
    '00000000-0000-0000-0000-000000000001'
),
(
    '550e8400-e29b-41d4-a716-446655440002', -- Support Specialist
    'praise',
    'Отличное пошаговое решение! Помогло быстро решить проблему',
    0.95,
    '00000000-0000-0000-0000-000000000001'
),
(
    '550e8400-e29b-41d4-a716-446655440001', -- AI Researcher
    'correction',
    'В ответе была неточность по поводу transformer архитектуры. Attention механизм работает по-другому',
    0.85,
    '00000000-0000-0000-0000-000000000001'
);

-- Add comments for documentation
COMMENT ON TABLE public.agent_feedback IS 'User feedback on agent responses for continuous improvement';
COMMENT ON TABLE public.prompt_improvement_logs IS 'History of automatic prompt improvements based on feedback';
COMMENT ON TABLE public.agent_performance_metrics IS 'Detailed performance tracking for agents';
COMMENT ON VIEW public.agent_feedback_summary IS 'Aggregated feedback statistics per agent';
COMMENT ON VIEW public.recent_agent_improvements IS 'Recent prompt improvements with context';
COMMENT ON FUNCTION trigger_improvement_analysis() IS 'Automatically triggers improvement analysis when feedback thresholds are met';
