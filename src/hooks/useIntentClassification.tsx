import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type IntentClassification = Tables<'intent_classifications'>;

export interface IntentResult {
  intent: string;
  confidence: number;
  suggestedAgentId?: string;
  reasoning?: string;
}

export const useIntentClassification = () => {
  const [classifying, setClassifying] = useState(false);

  // Classify user intent from message
  const classifyIntent = async (message: string, availableAgents: Tables<'agents'>[]): Promise<IntentResult> => {
    setClassifying(true);
    
    try {
      // Simple rule-based intent classification
      // In production, this would use an AI model or more sophisticated NLP
      const intent = await classifyIntentRules(message, availableAgents);
      
      return intent;
    } catch (error) {
      console.error('Intent classification failed:', error);
      // Fallback to general intent
      return {
        intent: 'general',
        confidence: 0.5,
        suggestedAgentId: availableAgents.find(a => a.role === 'assistant')?.id
      };
    } finally {
      setClassifying(false);
    }
  };

  // Rule-based intent classification
  const classifyIntentRules = async (message: string, availableAgents: Tables<'agents'>[]): Promise<IntentResult> => {
    const lowerMessage = message.toLowerCase();
    
    // Support/Technical issues
    if (
      lowerMessage.includes('проблема') ||
      lowerMessage.includes('ошибка') ||
      lowerMessage.includes('не работает') ||
      lowerMessage.includes('помогите') ||
      lowerMessage.includes('поддержка') ||
      lowerMessage.includes('техническая') ||
      lowerMessage.includes('сбой') ||
      lowerMessage.includes('баг') ||
      lowerMessage.includes('bug') ||
      lowerMessage.includes('error') ||
      lowerMessage.includes('help') ||
      lowerMessage.includes('support') ||
      lowerMessage.includes('issue') ||
      lowerMessage.includes('problem')
    ) {
      const supportAgent = availableAgents.find(a => a.role === 'support');
      return {
        intent: 'technical_support',
        confidence: 0.85,
        suggestedAgentId: supportAgent?.id,
        reasoning: 'Message contains support/technical keywords'
      };
    }

    // Document/PDF related questions
    if (
      lowerMessage.includes('документ') ||
      lowerMessage.includes('pdf') ||
      lowerMessage.includes('файл') ||
      lowerMessage.includes('страница') ||
      lowerMessage.includes('содержимое') ||
      lowerMessage.includes('прочитай') ||
      lowerMessage.includes('анализируй') ||
      lowerMessage.includes('document') ||
      lowerMessage.includes('file') ||
      lowerMessage.includes('page') ||
      lowerMessage.includes('content') ||
      lowerMessage.includes('read') ||
      lowerMessage.includes('analyze')
    ) {
      const generalAgent = availableAgents.find(a => a.role === 'assistant');
      return {
        intent: 'document_question',
        confidence: 0.9,
        suggestedAgentId: generalAgent?.id,
        reasoning: 'Message contains document/PDF keywords'
      };
    }

    // Business/Product questions
    if (
      lowerMessage.includes('продукт') ||
      lowerMessage.includes('услуга') ||
      lowerMessage.includes('цена') ||
      lowerMessage.includes('стоимость') ||
      lowerMessage.includes('функция') ||
      lowerMessage.includes('возможность') ||
      lowerMessage.includes('product') ||
      lowerMessage.includes('service') ||
      lowerMessage.includes('price') ||
      lowerMessage.includes('cost') ||
      lowerMessage.includes('feature') ||
      lowerMessage.includes('capability')
    ) {
      const supportAgent = availableAgents.find(a => a.role === 'support');
      return {
        intent: 'business_question',
        confidence: 0.8,
        suggestedAgentId: supportAgent?.id,
        reasoning: 'Message contains business/product keywords'
      };
    }

    // Creative/Content generation
    if (
      lowerMessage.includes('напиши') ||
      lowerMessage.includes('создай') ||
      lowerMessage.includes('придумай') ||
      lowerMessage.includes('сочини') ||
      lowerMessage.includes('write') ||
      lowerMessage.includes('create') ||
      lowerMessage.includes('generate') ||
      lowerMessage.includes('compose')
    ) {
      const generalAgent = availableAgents.find(a => a.role === 'assistant');
      return {
        intent: 'content_generation',
        confidence: 0.75,
        suggestedAgentId: generalAgent?.id,
        reasoning: 'Message contains content generation keywords'
      };
    }

    // Analysis/Research
    if (
      lowerMessage.includes('анализ') ||
      lowerMessage.includes('исследование') ||
      lowerMessage.includes('изучи') ||
      lowerMessage.includes('разбери') ||
      lowerMessage.includes('analysis') ||
      lowerMessage.includes('research') ||
      lowerMessage.includes('study') ||
      lowerMessage.includes('examine')
    ) {
      const generalAgent = availableAgents.find(a => a.role === 'assistant');
      return {
        intent: 'analysis_research',
        confidence: 0.8,
        suggestedAgentId: generalAgent?.id,
        reasoning: 'Message contains analysis/research keywords'
      };
    }

    // Code/Programming
    if (
      lowerMessage.includes('код') ||
      lowerMessage.includes('программирование') ||
      lowerMessage.includes('функция') ||
      lowerMessage.includes('алгоритм') ||
      lowerMessage.includes('code') ||
      lowerMessage.includes('programming') ||
      lowerMessage.includes('function') ||
      lowerMessage.includes('algorithm')
    ) {
      const generalAgent = availableAgents.find(a => a.role === 'assistant');
      return {
        intent: 'programming',
        confidence: 0.85,
        suggestedAgentId: generalAgent?.id,
        reasoning: 'Message contains programming keywords'
      };
    }

    // Default to general intent
    const generalAgent = availableAgents.find(a => a.role === 'assistant');
    return {
      intent: 'general',
      confidence: 0.6,
      suggestedAgentId: generalAgent?.id,
      reasoning: 'No specific intent detected, defaulting to general'
    };
  };

  // Save intent classification to database
  const saveIntentClassification = async (
    messageId: string,
    intent: string,
    confidence: number,
    suggestedAgentId?: string
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('intent_classifications')
        .insert({
          message_id: messageId,
          intent,
          confidence,
          suggested_agent_id: suggestedAgentId
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save intent classification:', error);
    }
  };

  // Get intent classification history for a message
  const getIntentClassification = async (messageId: string): Promise<IntentClassification | null> => {
    try {
      const { data, error } = await supabase
        .from('intent_classifications')
        .select('*')
        .eq('message_id', messageId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      return null;
    }
  };

  return {
    classifying,
    classifyIntent,
    saveIntentClassification,
    getIntentClassification
  };
};
