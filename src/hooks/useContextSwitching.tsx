import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdvancedIntentClassification } from './useAdvancedIntentClassification';

export interface ContextSwitchResult {
  shouldSwitch: boolean;
  newContext: 'rag' | 'history' | 'agent' | 'general';
  confidence: number;
  reasoning: string;
  suggestedDocuments?: string[];
  relevantHistory?: any[];
  suggestedAgent?: string;
}

export interface ConversationContext {
  chatId: string;
  currentContext: 'rag' | 'history' | 'agent' | 'general';
  activeDocuments: string[];
  relevantHistory: any[];
  contextScore: number;
  lastSwitchTime: string;
}

export const useContextSwitching = () => {
  const [currentContext, setCurrentContext] = useState<ConversationContext | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { classifyIntent } = useAdvancedIntentClassification();

  // Analyze message for context switching needs
  const analyzeContextSwitch = useCallback(async (
    message: string,
    chatId: string,
    currentChatContext?: ConversationContext
  ): Promise<ContextSwitchResult> => {
    setIsAnalyzing(true);

    try {
      const lowerMessage = message.toLowerCase();
      
      // Document/RAG indicators
      const documentKeywords = [
        'в документе', 'по документу', 'документация', 'pdf', 'файл',
        'in document', 'documentation', 'file', 'according to',
        'найти в', 'поиск по', 'что говорится в', 'на основе документа'
      ];

      // History/conversation indicators
      const historyKeywords = [
        'раньше говорили', 'ранее обсуждали', 'в прошлой беседе', 'помните',
        'previously discussed', 'earlier conversation', 'we talked about',
        'you mentioned', 'как вы сказали', 'продолжим тему'
      ];

      // Agent-specific task indicators
      const agentTaskKeywords = [
        'специалист по', 'эксперт в', 'кто может помочь с',
        'specialist in', 'expert in', 'who can help with',
        'нужен совет по', 'консультация по'
      ];

      // Technical/coding context
      const technicalKeywords = [
        'код', 'программирование', 'ошибка', 'баг', 'API',
        'code', 'programming', 'error', 'bug', 'development',
        'функция', 'алгоритм', 'база данных'
      ];

      let shouldSwitch = false;
      let newContext: ContextSwitchResult['newContext'] = 'general';
      let confidence = 0.5;
      let reasoning = '';
      let suggestedDocuments: string[] = [];
      let relevantHistory: any[] = [];
      let suggestedAgent: string | undefined;

      // Analyze for document context
      if (documentKeywords.some(keyword => lowerMessage.includes(keyword))) {
        shouldSwitch = true;
        newContext = 'rag';
        confidence = 0.85;
        reasoning = 'User is referencing documents or asking for document-based information';
        
        // Find relevant documents
        suggestedDocuments = await findRelevantDocuments(message, chatId);
      }
      
      // Analyze for history context
      else if (historyKeywords.some(keyword => lowerMessage.includes(keyword))) {
        shouldSwitch = true;
        newContext = 'history';
        confidence = 0.8;
        reasoning = 'User is referencing previous conversation or asking for historical context';
        
        // Get relevant conversation history
        relevantHistory = await getRelevantHistory(message, chatId);
      }
      
      // Analyze for agent specialization
      else if (agentTaskKeywords.some(keyword => lowerMessage.includes(keyword)) ||
               technicalKeywords.some(keyword => lowerMessage.includes(keyword))) {
        
        // Use intent classification to determine best agent
        const intentResult = await classifyIntent(message);
        if (intentResult.suggestedAgentId) {
          shouldSwitch = true;
          newContext = 'agent';
          confidence = intentResult.confidence;
          reasoning = `User task requires specialized agent: ${intentResult.intent}`;
          suggestedAgent = intentResult.suggestedAgentId;
        }
      }

      // Check if context switch is beneficial
      if (currentChatContext && !shouldSwitch) {
        // Analyze current context effectiveness
        const contextEffectiveness = await analyzeCurrentContextEffectiveness(
          currentChatContext, 
          message
        );
        
        if (contextEffectiveness.score < 0.6) {
          shouldSwitch = true;
          newContext = contextEffectiveness.suggestedContext;
          confidence = contextEffectiveness.confidence;
          reasoning = contextEffectiveness.reason;
        }
      }

      return {
        shouldSwitch,
        newContext,
        confidence,
        reasoning,
        suggestedDocuments,
        relevantHistory,
        suggestedAgent
      };

    } finally {
      setIsAnalyzing(false);
    }
  }, [classifyIntent]);

  // Find relevant documents based on message content
  const findRelevantDocuments = useCallback(async (
    message: string, 
    chatId: string
  ): Promise<string[]> => {
    try {
      // Get chat's associated documents
      const { data: chat } = await supabase
        .from('chats')
        .select('document_ids')
        .eq('id', chatId)
        .single();

      if (!chat?.document_ids?.length) {
        // Search all user's documents if no specific documents associated
        const { data: documents } = await supabase
          .from('documents')
          .select('id, file_name')
          .limit(5);

        return documents?.map(d => d.id) || [];
      }

      return chat.document_ids;
    } catch (error) {
      console.error('Error finding relevant documents:', error);
      return [];
    }
  }, []);

  // Get relevant conversation history
  const getRelevantHistory = useCallback(async (
    message: string,
    chatId: string
  ): Promise<any[]> => {
    try {
      // Extract key terms from the message
      const keyTerms = extractKeyTerms(message);
      
      // Search for relevant messages in chat history
      const { data: relevantMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!relevantMessages) return [];

      // Score messages based on relevance to current message
      const scoredMessages = relevantMessages.map(msg => ({
        ...msg,
        relevanceScore: calculateMessageRelevance(msg.content, keyTerms)
      }))
      .filter(msg => msg.relevanceScore > 0.3)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);

      return scoredMessages;
    } catch (error) {
      console.error('Error getting relevant history:', error);
      return [];
    }
  }, []);

  // Extract key terms from message for relevance analysis
  const extractKeyTerms = (message: string): string[] => {
    const lowerMessage = message.toLowerCase();
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were',
      'и', 'или', 'но', 'в', 'на', 'с', 'по', 'для', 'от', 'до', 'это', 'что', 'как', 'где', 'когда'
    ]);

    return lowerMessage
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Top 10 key terms
  };

  // Calculate relevance score between two messages
  const calculateMessageRelevance = (messageContent: string, keyTerms: string[]): number => {
    const lowerContent = messageContent.toLowerCase();
    const matches = keyTerms.filter(term => lowerContent.includes(term));
    return matches.length / keyTerms.length;
  };

  // Analyze effectiveness of current context
  const analyzeCurrentContextEffectiveness = useCallback(async (
    context: ConversationContext,
    newMessage: string
  ): Promise<{
    score: number;
    suggestedContext: ContextSwitchResult['newContext'];
    confidence: number;
    reason: string;
  }> => {
    let score = 0.7; // Default neutral score
    let suggestedContext: ContextSwitchResult['newContext'] = context.currentContext;
    let confidence = 0.5;
    let reason = 'Current context seems appropriate';

    // Check time since last context switch
    const timeSinceSwitch = Date.now() - new Date(context.lastSwitchTime).getTime();
    const minutesSinceSwitch = timeSinceSwitch / (1000 * 60);

    // If recent switch, increase threshold for new switch
    if (minutesSinceSwitch < 5) {
      score += 0.2;
    }

    // Analyze message content against current context
    const lowerMessage = newMessage.toLowerCase();

    if (context.currentContext === 'rag') {
      // Check if message still relates to documents
      const docKeywords = ['документ', 'файл', 'pdf', 'document', 'file'];
      const hasDocKeywords = docKeywords.some(keyword => lowerMessage.includes(keyword));
      
      if (!hasDocKeywords && !context.activeDocuments.length) {
        score = 0.4;
        suggestedContext = 'general';
        confidence = 0.7;
        reason = 'Message no longer seems document-related and no active documents';
      }
    } else if (context.currentContext === 'history') {
      // Check if message still relates to history
      const historyKeywords = ['раньше', 'ранее', 'помните', 'previously', 'earlier'];
      const hasHistoryKeywords = historyKeywords.some(keyword => lowerMessage.includes(keyword));
      
      if (!hasHistoryKeywords) {
        score = 0.5;
        suggestedContext = 'general';
        confidence = 0.6;
        reason = 'Message no longer references conversation history';
      }
    }

    return { score, suggestedContext, confidence, reason };
  }, []);

  // Execute context switch
  const executeContextSwitch = useCallback(async (
    chatId: string,
    switchResult: ContextSwitchResult
  ): Promise<ConversationContext> => {
    const newContext: ConversationContext = {
      chatId,
      currentContext: switchResult.newContext,
      activeDocuments: switchResult.suggestedDocuments || [],
      relevantHistory: switchResult.relevantHistory || [],
      contextScore: switchResult.confidence,
      lastSwitchTime: new Date().toISOString()
    };

    // Update chat metadata with new context
    await supabase
      .from('chats')
      .update({
        meta: {
          ...newContext,
          switchReason: switchResult.reasoning
        }
      })
      .eq('id', chatId);

    // Log context switch for analytics
    await supabase
      .from('context_switches')
      .insert({
        chat_id: chatId,
        from_context: currentContext?.currentContext || 'general',
        to_context: switchResult.newContext,
        trigger_message: switchResult.reasoning,
        confidence: switchResult.confidence,
        metadata: {
          suggestedDocuments: switchResult.suggestedDocuments,
          suggestedAgent: switchResult.suggestedAgent
        }
      });

    setCurrentContext(newContext);
    return newContext;
  }, [currentContext]);

  // Get current conversation context
  const getCurrentContext = useCallback(async (chatId: string): Promise<ConversationContext | null> => {
    try {
      const { data: chat } = await supabase
        .from('chats')
        .select('meta')
        .eq('id', chatId)
        .single();

      if (chat?.meta && typeof chat.meta === 'object' && 'currentContext' in chat.meta) {
        const context = chat.meta as ConversationContext;
        setCurrentContext(context);
        return context;
      }

      return null;
    } catch (error) {
      console.error('Error getting current context:', error);
      return null;
    }
  }, []);

  // Initialize context for chat
  useEffect(() => {
    if (currentContext?.chatId) {
      getCurrentContext(currentContext.chatId);
    }
  }, [currentContext?.chatId, getCurrentContext]);

  return {
    // State
    currentContext,
    isAnalyzing,

    // Actions
    analyzeContextSwitch,
    executeContextSwitch,
    getCurrentContext,

    // Utilities
    findRelevantDocuments,
    getRelevantHistory
  };
};
