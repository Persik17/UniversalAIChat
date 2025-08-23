import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAgents } from './useAgents';
import { useToast } from './use-toast';
import { Tables } from '@/integrations/supabase/types';

export type Agent = Tables<'agents'>;

export interface FeedbackType {
  id: string;
  agent_id: string;
  message_id?: string;
  feedback_type: 'correction' | 'improvement' | 'praise' | 'suggestion';
  original_response?: string;
  suggested_response?: string;
  user_feedback: string;
  confidence_score: number;
  created_at: string;
}

export interface PromptImprovementLog {
  id: string;
  agent_id: string;
  old_prompt: string;
  new_prompt: string;
  improvement_reason: string;
  feedback_ids: string[];
  performance_before: any;
  performance_after?: any;
  created_at: string;
}

export const useSelfImprovingAgents = () => {
  const { updateAgent, getAgentById } = useAgents();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackType[]>([]);
  const [improvementLogs, setImprovementLogs] = useState<PromptImprovementLog[]>([]);

  // Collect user feedback on agent responses
  const collectFeedback = useCallback(async (feedback: Omit<FeedbackType, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('agent_feedback')
        .insert({
          agent_id: feedback.agent_id,
          message_id: feedback.message_id,
          feedback_type: feedback.feedback_type,
          original_response: feedback.original_response,
          suggested_response: feedback.suggested_response,
          user_feedback: feedback.user_feedback,
          confidence_score: feedback.confidence_score
        })
        .select()
        .single();

      if (error) throw error;

      setFeedbackHistory(prev => [data, ...prev]);

      // Trigger improvement analysis if enough feedback collected
      await analyzeFeedbackForImprovement(feedback.agent_id);

      toast({
        title: "Обратная связь сохранена",
        description: "Агент будет улучшен на основе вашего отзыва",
      });

      return data;
    } catch (error) {
      console.error('Error collecting feedback:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить обратную связь",
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  // Analyze feedback patterns and suggest improvements
  const analyzeFeedbackForImprovement = useCallback(async (agentId: string) => {
    try {
      setIsProcessing(true);

      // Get recent feedback for this agent
      const { data: recentFeedback, error: feedbackError } = await supabase
        .from('agent_feedback')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (feedbackError) throw feedbackError;

      // Only proceed if we have enough feedback
      if (!recentFeedback || recentFeedback.length < 3) {
        return;
      }

      // Analyze feedback patterns
      const feedbackAnalysis = analyzeAggregatedFeedback(recentFeedback);

      // Check if improvement is needed
      if (feedbackAnalysis.shouldImprove) {
        await suggestPromptImprovement(agentId, recentFeedback, feedbackAnalysis);
      }

    } catch (error) {
      console.error('Error analyzing feedback:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Analyze aggregated feedback to determine improvement needs
  const analyzeAggregatedFeedback = (feedback: FeedbackType[]) => {
    const totalFeedback = feedback.length;
    const negativeFeedback = feedback.filter(f => 
      f.feedback_type === 'correction' || f.feedback_type === 'improvement'
    ).length;
    const averageConfidence = feedback.reduce((sum, f) => sum + f.confidence_score, 0) / totalFeedback;

    // Identify common issues
    const commonIssues = identifyCommonIssues(feedback);
    
    const shouldImprove = (
      negativeFeedback / totalFeedback > 0.3 || // More than 30% negative feedback
      averageConfidence < 0.7 || // Low confidence scores
      commonIssues.length > 0 // Specific issues identified
    );

    return {
      shouldImprove,
      negativeFeedbackRatio: negativeFeedback / totalFeedback,
      averageConfidence,
      commonIssues,
      totalFeedback
    };
  };

  // Identify common issues from feedback
  const identifyCommonIssues = (feedback: FeedbackType[]) => {
    const issues: string[] = [];
    const feedbackTexts = feedback.map(f => f.user_feedback.toLowerCase());

    // Check for common patterns
    const patterns = {
      'accuracy': ['неточно', 'неправильно', 'ошибка', 'incorrect', 'wrong'],
      'clarity': ['непонятно', 'сложно', 'unclear', 'confusing'],
      'completeness': ['неполно', 'не хватает', 'incomplete', 'missing'],
      'relevance': ['не по теме', 'irrelevant', 'off-topic'],
      'tone': ['грубо', 'невежливо', 'rude', 'impolite']
    };

    Object.entries(patterns).forEach(([issue, keywords]) => {
      const matchCount = feedbackTexts.filter(text => 
        keywords.some(keyword => text.includes(keyword))
      ).length;

      if (matchCount >= 2) { // If issue appears in 2+ feedback items
        issues.push(issue);
      }
    });

    return issues;
  };

  // Suggest and apply prompt improvements
  const suggestPromptImprovement = useCallback(async (
    agentId: string, 
    feedback: FeedbackType[], 
    analysis: any
  ) => {
    try {
      const agent = await getAgentById(agentId);
      if (!agent) throw new Error('Agent not found');

      // Generate improved prompt
      const improvedPrompt = await generateImprovedPrompt(agent, feedback, analysis);
      
      // Log the improvement
      const improvementLog: Omit<PromptImprovementLog, 'id' | 'created_at'> = {
        agent_id: agentId,
        old_prompt: agent.system_prompt,
        new_prompt: improvedPrompt.prompt,
        improvement_reason: improvedPrompt.reason,
        feedback_ids: feedback.map(f => f.id),
        performance_before: agent.performance_metrics
      };

      const { data: logData, error: logError } = await supabase
        .from('prompt_improvement_logs')
        .insert(improvementLog)
        .select()
        .single();

      if (logError) throw logError;

      // Update agent prompt
      await updateAgent(agentId, {
        system_prompt: improvedPrompt.prompt,
        last_updated: new Date().toISOString()
      });

      setImprovementLogs(prev => [logData, ...prev]);

      toast({
        title: "Агент улучшен",
        description: `Промпт агента обновлен на основе анализа обратной связи`,
      });

      return logData;
    } catch (error) {
      console.error('Error improving agent:', error);
      toast({
        title: "Ошибка улучшения",
        description: "Не удалось улучшить агента",
        variant: "destructive",
      });
      throw error;
    }
  }, [updateAgent, getAgentById, toast]);

  // Generate improved prompt based on feedback
  const generateImprovedPrompt = async (
    agent: Agent, 
    feedback: FeedbackType[], 
    analysis: any
  ): Promise<{ prompt: string; reason: string }> => {
    let improvedPrompt = agent.system_prompt;
    let improvementReasons: string[] = [];

    // Address common issues
    if (analysis.commonIssues.includes('accuracy')) {
      improvedPrompt += '\n\n**Точность и Проверка Фактов:**\n- Всегда проверяй факты перед ответом\n- При неуверенности, указывай на ограничения знаний\n- Ссылайся на источники когда возможно';
      improvementReasons.push('Улучшена точность ответов');
    }

    if (analysis.commonIssues.includes('clarity')) {
      improvedPrompt += '\n\n**Ясность Коммуникации:**\n- Используй простой и понятный язык\n- Структурируй ответы с заголовками и списками\n- Избегай излишней технической терминологии без объяснений';
      improvementReasons.push('Улучшена ясность изложения');
    }

    if (analysis.commonIssues.includes('completeness')) {
      improvedPrompt += '\n\n**Полнота Ответов:**\n- Обеспечивай comprehensive coverage темы\n- Предвосхищай follow-up вопросы\n- Предлагай дополнительные ресурсы когда уместно';
      improvementReasons.push('Улучшена полнота ответов');
    }

    if (analysis.commonIssues.includes('relevance')) {
      improvedPrompt += '\n\n**Релевантность:**\n- Внимательно анализируй контекст вопроса\n- Фокусируйся на specific needs пользователя\n- Избегай отклонений от основной темы';
      improvementReasons.push('Улучшена релевантность');
    }

    if (analysis.commonIssues.includes('tone')) {
      improvedPrompt += '\n\n**Тон и Стиль:**\n- Поддерживай дружелюбный и профессиональный тон\n- Проявляй эмпатию к проблемам пользователя\n- Избегай категоричных утверждений';
      improvementReasons.push('Улучшен тон общения');
    }

    // Add specific improvements based on feedback
    const corrections = feedback.filter(f => f.feedback_type === 'correction');
    if (corrections.length > 0) {
      improvedPrompt += '\n\n**Специальные Инструкции на основе пользовательских корректировок:**\n';
      corrections.forEach((correction, index) => {
        improvedPrompt += `${index + 1}. ${correction.user_feedback}\n`;
      });
      improvementReasons.push('Добавлены специальные инструкции');
    }

    return {
      prompt: improvedPrompt,
      reason: improvementReasons.join(', ')
    };
  };

  // Get feedback history for an agent
  const getFeedbackHistory = useCallback(async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('agent_feedback')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedbackHistory(data || []);
      return data;
    } catch (error) {
      console.error('Error fetching feedback history:', error);
      return [];
    }
  }, []);

  // Get improvement logs for an agent
  const getImprovementLogs = useCallback(async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('prompt_improvement_logs')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImprovementLogs(data || []);
      return data;
    } catch (error) {
      console.error('Error fetching improvement logs:', error);
      return [];
    }
  }, []);

  // Manually trigger improvement analysis
  const triggerImprovementAnalysis = useCallback(async (agentId: string) => {
    await analyzeFeedbackForImprovement(agentId);
  }, [analyzeFeedbackForImprovement]);

  return {
    // State
    isProcessing,
    feedbackHistory,
    improvementLogs,

    // Actions
    collectFeedback,
    getFeedbackHistory,
    getImprovementLogs,
    triggerImprovementAnalysis,
    
    // Analysis functions
    analyzeFeedbackForImprovement
  };
};
