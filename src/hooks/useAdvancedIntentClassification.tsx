import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAgents } from './useAgents';

export interface IntentResult {
  intent: string;
  confidence: number;
  suggestedAgentId?: string;
  reasoning?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  requiresEscalation?: boolean;
  autoResponse?: string;
}

export interface SupportTicketClassification {
  category: 'technical' | 'billing' | 'general' | 'feature_request' | 'bug_report';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedResolutionTime: number; // in minutes
  requiresHumanEscalation: boolean;
}

export const useAdvancedIntentClassification = () => {
  const [isClassifying, setIsClassifying] = useState(false);
  const { getAgentsByRole } = useAgents();

  // Enhanced intent classification with support automation
  const classifyIntent = useCallback(async (message: string): Promise<IntentResult> => {
    setIsClassifying(true);
    
    try {
      const lowerMessage = message.toLowerCase();
      
      // Priority patterns for urgent issues
      const urgentPatterns = [
        'критическая ошибка', 'сайт не работает', 'система упала', 'critical error',
        'site down', 'system crash', 'urgent', 'срочно', 'emergency'
      ];
      
      // Technical support patterns with severity
      const technicalPatterns = {
        high: [
          'не работает', 'система упала', 'ошибка 500', 'база данных',
          'not working', 'system down', '500 error', 'database error'
        ],
        medium: [
          'проблема с загрузкой', 'медленно работает', 'timeout',
          'loading issues', 'slow performance', 'connection timeout'
        ],
        low: [
          'как настроить', 'how to configure', 'вопрос по функции',
          'question about feature', 'help with setup'
        ]
      };
      
      // Document/RAG related patterns
      const documentPatterns = [
        'документ', 'файл', 'pdf', 'загрузить', 'поиск по документу',
        'document', 'file', 'search', 'upload', 'найти в документе',
        'в документации', 'in documentation'
      ];
      
      // Research patterns
      const researchPatterns = [
        'исследование', 'анализ', 'изучить', 'найти информацию', 'сравнить',
        'research', 'analysis', 'study', 'compare', 'analyze', 'investigate'
      ];

      // Feature request patterns
      const featurePatterns = [
        'добавить функцию', 'новая возможность', 'feature request',
        'add feature', 'enhancement', 'improvement', 'предложение'
      ];

      // Bug report patterns
      const bugPatterns = [
        'баг', 'ошибка в коде', 'неправильно работает', 'bug',
        'code error', 'incorrect behavior', 'broken feature'
      ];

      let intent = 'general';
      let confidence = 0.5;
      let suggestedAgentId: string | undefined;
      let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
      let requiresEscalation = false;
      let autoResponse: string | undefined;

      // Check for urgent issues first
      if (urgentPatterns.some(pattern => lowerMessage.includes(pattern))) {
        intent = 'urgent_support';
        confidence = 0.95;
        priority = 'urgent';
        requiresEscalation = true;
        
        // Get support agents
        const supportAgents = await getAgentsByRole('support');
        suggestedAgentId = supportAgents[0]?.id;
        
        autoResponse = 'Обнаружена критическая проблема. Перенаправляю к агенту поддержки с высоким приоритетом.';
      }
      // Technical support classification
      else if (Object.values(technicalPatterns).flat().some(pattern => lowerMessage.includes(pattern))) {
        intent = 'technical_support';
        
        // Determine priority based on specific patterns
        if (technicalPatterns.high.some(pattern => lowerMessage.includes(pattern))) {
          priority = 'high';
          confidence = 0.9;
        } else if (technicalPatterns.medium.some(pattern => lowerMessage.includes(pattern))) {
          priority = 'medium';
          confidence = 0.8;
        } else {
          priority = 'low';
          confidence = 0.7;
        }
        
        const supportAgents = await getAgentsByRole('support');
        suggestedAgentId = supportAgents[0]?.id;
      }
      // Document/RAG questions
      else if (documentPatterns.some(pattern => lowerMessage.includes(pattern))) {
        intent = 'document_question';
        confidence = 0.85;
        priority = 'low';
        // RAG system handles this, but researcher might help too
        const researchers = await getAgentsByRole('researcher');
        suggestedAgentId = researchers[0]?.id;
      }
      // Research requests
      else if (researchPatterns.some(pattern => lowerMessage.includes(pattern))) {
        intent = 'research_request';
        confidence = 0.8;
        priority = 'medium';
        
        const researchers = await getAgentsByRole('researcher');
        suggestedAgentId = researchers[0]?.id;
      }
      // Feature requests
      else if (featurePatterns.some(pattern => lowerMessage.includes(pattern))) {
        intent = 'feature_request';
        confidence = 0.75;
        priority = 'low';
        
        autoResponse = 'Спасибо за предложение! Ваш запрос на новую функцию передан команде разработки для рассмотрения.';
      }
      // Bug reports
      else if (bugPatterns.some(pattern => lowerMessage.includes(pattern))) {
        intent = 'bug_report';
        confidence = 0.8;
        priority = 'medium';
        
        const supportAgents = await getAgentsByRole('support');
        suggestedAgentId = supportAgents[0]?.id;
        
        autoResponse = 'Обнаружен отчет об ошибке. Собираю дополнительную информацию для диагностики.';
      }

      return {
        intent,
        confidence,
        suggestedAgentId,
        priority,
        requiresEscalation,
        autoResponse,
        reasoning: `Detected ${intent} intent with ${priority} priority based on pattern analysis`
      };
    } finally {
      setIsClassifying(false);
    }
  }, [getAgentsByRole]);

  // Classify support tickets with detailed categorization
  const classifySupportTicket = useCallback(async (message: string): Promise<SupportTicketClassification> => {
    const lowerMessage = message.toLowerCase();
    
    let category: SupportTicketClassification['category'] = 'general';
    let priority: SupportTicketClassification['priority'] = 'medium';
    let complexity: SupportTicketClassification['complexity'] = 'moderate';
    let estimatedResolutionTime = 30; // default 30 minutes
    let requiresHumanEscalation = false;

    // Technical issues
    if (['ошибка', 'не работает', 'error', 'broken', 'crash'].some(word => lowerMessage.includes(word))) {
      category = 'technical';
      
      // High complexity technical issues
      if (['база данных', 'database', 'API', 'интеграция', 'integration'].some(word => lowerMessage.includes(word))) {
        complexity = 'complex';
        priority = 'high';
        estimatedResolutionTime = 120;
        requiresHumanEscalation = true;
      }
      // Medium complexity
      else if (['загрузка', 'performance', 'медленно', 'timeout'].some(word => lowerMessage.includes(word))) {
        complexity = 'moderate';
        priority = 'medium';
        estimatedResolutionTime = 60;
      }
      // Simple issues
      else {
        complexity = 'simple';
        priority = 'low';
        estimatedResolutionTime = 15;
      }
    }
    // Bug reports
    else if (['баг', 'bug', 'неправильно', 'incorrect'].some(word => lowerMessage.includes(word))) {
      category = 'bug_report';
      complexity = 'moderate';
      priority = 'medium';
      estimatedResolutionTime = 45;
    }
    // Feature requests
    else if (['функция', 'feature', 'добавить', 'add', 'enhancement'].some(word => lowerMessage.includes(word))) {
      category = 'feature_request';
      complexity = 'simple';
      priority = 'low';
      estimatedResolutionTime = 5; // Just to log and forward
    }
    // Billing issues
    else if (['оплата', 'billing', 'payment', 'счет', 'subscription'].some(word => lowerMessage.includes(word))) {
      category = 'billing';
      complexity = 'simple';
      priority = 'medium';
      estimatedResolutionTime = 20;
    }

    // Escalation criteria
    if (priority === 'high' || 
        ['critical', 'критический', 'urgent', 'срочно'].some(word => lowerMessage.includes(word))) {
      requiresHumanEscalation = true;
      priority = 'urgent';
    }

    return {
      category,
      priority,
      complexity,
      estimatedResolutionTime,
      requiresHumanEscalation
    };
  }, []);

  // Auto-route messages to appropriate agents
  const autoRouteMessage = useCallback(async (message: string, chatId: string) => {
    try {
      const intentResult = await classifyIntent(message);
      const ticketClassification = await classifySupportTicket(message);

      // Create support ticket if needed
      if (intentResult.intent.includes('support') || ticketClassification.requiresHumanEscalation) {
        await createSupportTicket(chatId, message, intentResult, ticketClassification);
      }

      // Auto-assign agent if suggested
      if (intentResult.suggestedAgentId) {
        await assignAgentToChat(chatId, intentResult.suggestedAgentId, intentResult.reasoning || '');
      }

      return {
        intentResult,
        ticketClassification,
        autoResponse: intentResult.autoResponse
      };
    } catch (error) {
      console.error('Error in auto-routing:', error);
      throw error;
    }
  }, [classifyIntent, classifySupportTicket]);

  // Create support ticket
  const createSupportTicket = useCallback(async (
    chatId: string, 
    message: string,
    intentResult: IntentResult,
    classification: SupportTicketClassification
  ) => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          chat_id: chatId,
          title: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
          description: message,
          category: classification.category,
          priority: classification.priority,
          status: 'open',
          agent_id: intentResult.suggestedAgentId,
          estimated_resolution_time: classification.estimatedResolutionTime,
          requires_escalation: classification.requiresHumanEscalation,
          metadata: {
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            complexity: classification.complexity
          }
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating support ticket:', error);
      // Don't throw error to not break the flow
      return null;
    }
  }, []);

  // Assign agent to chat
  const assignAgentToChat = useCallback(async (chatId: string, agentId: string, reason: string) => {
    try {
      // Update chat with assigned agent
      await supabase
        .from('chats')
        .update({ 
          agent_ids: [agentId],
          chat_type: 'support'
        })
        .eq('id', chatId);

      // Log the assignment
      await supabase
        .from('agent_assignments')
        .insert({
          chat_id: chatId,
          agent_id: agentId,
          assignment_reason: reason,
          status: 'active'
        });

    } catch (error) {
      console.error('Error assigning agent to chat:', error);
      // Don't throw error to not break the flow
    }
  }, []);

  return {
    classifyIntent,
    classifySupportTicket,
    autoRouteMessage,
    isClassifying
  };
};
