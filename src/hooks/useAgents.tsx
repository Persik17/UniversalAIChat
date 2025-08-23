import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  role: string;
  model: string;
  system_prompt: string;
  created_at: string;
  updated_at: string;
}

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load agents
  const loadAgents = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('agents');

      if (error) {
        throw error;
      }

      setAgents(data || []);
    } catch (error) {
      console.error('Error loading agents:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить агентов",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Create agent
  const createAgent = async (agentData: {
    name: string;
    role?: string;
    model?: string;
    system_prompt: string;
  }) => {
    if (!user) return null;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('agents', {
        body: {
          name: agentData.name,
          role: agentData.role || 'assistant',
          model: agentData.model || 'gpt-5-2025-08-07',
          system_prompt: agentData.system_prompt
        }
      });

      if (error) {
        throw error;
      }

      await loadAgents();
      
      toast({
        title: "Успешно",
        description: "Агент создан",
      });

      return data;
    } catch (error) {
      console.error('Error creating agent:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать агента",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Update agent
  const updateAgent = async (agentId: string, updates: Partial<Agent>) => {
    if (!user) return null;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('agents', {
        body: updates
      });

      if (error) {
        throw error;
      }

      await loadAgents();
      
      toast({
        title: "Успешно",
        description: "Агент обновлен",
      });

      return data;
    } catch (error) {
      console.error('Error updating agent:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить агента",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Send feedback to agent (learning)
  const sendFeedback = async (agentId: string, correction: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.functions.invoke('agents', {
        body: { agentId, correction }
      });

      if (error) {
        throw error;
      }

      await loadAgents();
      
      toast({
        title: "Успешно",
        description: "Обратная связь отправлена, агент обучен",
      });

      return data;
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить обратную связь",
        variant: "destructive",
      });
      return null;
    }
  };

  // Delete agent
  const deleteAgent = async (agentId: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }

      await loadAgents();
      
      toast({
        title: "Успешно",
        description: "Агент удален",
      });
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить агента",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      loadAgents();
    }
  }, [user]);

  return {
    agents,
    loading,
    createAgent,
    updateAgent,
    sendFeedback,
    deleteAgent,
    loadAgents
  };
};