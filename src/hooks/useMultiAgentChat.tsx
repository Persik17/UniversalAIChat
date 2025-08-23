import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export interface ConversationState {
  [key: string]: unknown;
  currentTurn: number;
  maxTurns: number;
  participants: string[];
  topic: string;
  messages: Array<{
    agentId: string;
    content: string;
    timestamp: string;
  }>;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
}

export interface AgentConversation {
  id: string;
  chat_id: string;
  agent_ids: string[];
  conversation_state: Json;
  status: string;
  created_at: string;
  updated_at: string;
}

export const useMultiAgentChat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [loading, setLoading] = useState(false);

  // Load conversations for the current user
  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('agent_conversations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading conversations:', error);
        return;
      }

      // Ensure all required fields are present
      const validConversations = (data || []).map(conv => ({
        id: conv.id,
        chat_id: conv.chat_id,
        agent_ids: conv.agent_ids || [],
        conversation_state: conv.conversation_state,
        status: conv.status || 'active',
        created_at: conv.created_at,
        updated_at: conv.updated_at
      })) as AgentConversation[];

      setConversations(validConversations);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [user]);

  // Start a new multi-agent conversation
  const startAgentConversation = useCallback(async (
    chatId: string,
    agentIds: string[],
    topic: string,
    maxTurns: number = 5
  ): Promise<void> => {
    if (!user || !chatId || agentIds.length === 0) {
      throw new Error('Invalid parameters for starting conversation');
    }

    try {
      setLoading(true);

      const initialState: ConversationState = {
        currentTurn: 0,
        maxTurns,
        participants: agentIds,
        topic,
        messages: [],
        status: 'active'
      };

      const { error: insertError } = await supabase
        .from('agent_conversations')
        .insert({
          chat_id: chatId,
          agent_ids: agentIds,
          conversation_state: initialState as unknown as Json,
          status: 'active'
        });

      if (insertError) {
        console.error('Error starting conversation:', insertError);
        throw new Error(insertError.message);
      }

      toast({
        title: 'Разговор агентов запущен',
        description: `Агенты обсуждают тему: "${topic}"`,
      });

      // Reload conversations
      await loadConversations();
    } catch (err) {
      console.error('Error starting agent conversation:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast({
        title: 'Ошибка запуска разговора',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, toast, loadConversations]);

  // Continue conversation with next turn
  const continueConversation = useCallback(async (
    conversationId: string,
    agentId: string,
    message: string
  ): Promise<void> => {
    try {
      setLoading(true);

      // Get current conversation state
      const { data: conversation, error: fetchError } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (fetchError || !conversation) {
        throw new Error('Conversation not found');
      }

      const currentState = conversation.conversation_state as unknown as ConversationState;
      
      // Add new message
      const newMessage = {
        agentId,
        content: message,
        timestamp: new Date().toISOString()
      };

      const updatedState: ConversationState = {
        ...currentState,
        currentTurn: currentState.currentTurn + 1,
        messages: [...currentState.messages, newMessage],
        status: currentState.currentTurn + 1 >= currentState.maxTurns ? 'completed' : 'active'
      };

      // Update conversation state
      const { error: updateError } = await supabase
        .from('agent_conversations')
        .update({
          conversation_state: updatedState as unknown as Json,
          status: updatedState.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Reload conversations
      await loadConversations();
    } catch (err) {
      console.error('Error continuing conversation:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast({
        title: 'Ошибка продолжения разговора',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast, loadConversations]);

  // End conversation
  const endConversation = useCallback(async (conversationId: string): Promise<void> => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('agent_conversations')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: 'Разговор завершен',
        description: 'Разговор агентов успешно завершен',
      });

      // Reload conversations
      await loadConversations();
    } catch (err) {
      console.error('Error ending conversation:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast({
        title: 'Ошибка завершения разговора',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast, loadConversations]);

  // Get conversation by chat ID
  const getConversationByChatId = useCallback(async (chatId: string): Promise<AgentConversation | null> => {
    try {
      const { data, error } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('chat_id', chatId)
        .eq('status', 'active')
        .single();

      if (error) {
        return null;
      }

      return data as AgentConversation;
    } catch (err) {
      return null;
    }
  }, []);

  // Get conversation status
  const getConversationStatus = useCallback(async (conversationId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('agent_conversations')
        .select('status')
        .eq('id', conversationId)
        .single();

      if (error) {
        return null;
      }

      return data?.status || null;
    } catch (err) {
      return null;
    }
  }, []);

  // Process multi-agent message (simulated agent response)
  const processMultiAgentMessage = useCallback(async (
    conversationId: string,
    agentId: string,
    context: string
  ): Promise<string> => {
    try {
      // Simulate agent response based on role
      const agentResponse = `Агент ${agentId} отвечает на тему "${context}": Это симуляция ответа агента. В реальной реализации здесь будет интеграция с AI моделью для генерации ответов.`;
      
      // Add message to conversation
      await continueConversation(conversationId, agentId, agentResponse);
      
      return agentResponse;
    } catch (err) {
      console.error('Error processing multi-agent message:', err);
      return 'Ошибка обработки сообщения агента';
    }
  }, [continueConversation]);

  // Load conversations when user changes
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    loading,
    startAgentConversation,
    continueConversation,
    endConversation,
    getConversationByChatId,
    getConversationStatus,
    processMultiAgentMessage,
    loadConversations
  };
};
