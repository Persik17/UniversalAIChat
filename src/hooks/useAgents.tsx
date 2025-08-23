import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description: string;
  system_prompt: string;
  role: string;
  is_active: boolean;
  conversation_history?: any;
  performance_metrics?: any;
  last_updated?: string;
  created_at: string;
}

export interface CreateAgentData {
  name: string;
  description: string;
  system_prompt: string;
  role: string;
}

export interface UpdateAgentData {
  name?: string;
  description?: string;
  system_prompt?: string;
  role?: string;
  is_active?: boolean;
}

export const useAgents = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load agents for the current user
  const loadAgents = useCallback(async () => {
    if (!user) {
      setAgents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching agents:', fetchError);
        setError(fetchError.message);
        toast({
          title: 'Ошибка загрузки агентов',
          description: fetchError.message,
          variant: 'destructive',
        });
        return;
      }

      setAgents(data || []);
    } catch (err) {
      console.error('Unexpected error loading agents:', err);
      setError('Неожиданная ошибка при загрузке агентов');
      toast({
        title: 'Ошибка загрузки агентов',
        description: 'Неожиданная ошибка при загрузке агентов',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Create a new agent
  const createAgent = useCallback(async (agentData: CreateAgentData): Promise<Agent> => {
    if (!user) {
      throw new Error('Пользователь не авторизован');
    }

    try {
      const { data, error: insertError } = await supabase
        .from('agents')
        .insert({
          ...agentData,
          user_id: user.id,
          is_active: true,
          conversation_history: [],
          performance_metrics: {
            accuracy: 0.8,
            response_time: 1.5,
            user_satisfaction: 4.0
          }
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating agent:', insertError);
        throw new Error(insertError.message);
      }

      if (!data) {
        throw new Error('Агент не был создан');
      }

      // Add to local state
      setAgents(prev => [data, ...prev]);

      toast({
        title: 'Агент создан',
        description: `Агент "${agentData.name}" успешно создан`,
      });

      return data;
    } catch (err) {
      console.error('Error creating agent:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast({
        title: 'Ошибка создания агента',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  }, [user, toast]);

  // Update an existing agent
  const updateAgent = useCallback(async (agentId: string, updateData: UpdateAgentData): Promise<Agent> => {
    if (!user) {
      throw new Error('Пользователь не авторизован');
    }

    try {
      const { data, error: updateError } = await supabase
        .from('agents')
        .update({
          ...updateData,
          last_updated: new Date().toISOString()
        })
        .eq('id', agentId)
        .eq('user_id', user.id) // Ensure user can only update their own agents
        .select()
        .single();

      if (updateError) {
        console.error('Error updating agent:', updateError);
        throw new Error(updateError.message);
      }

      if (!data) {
        throw new Error('Агент не найден');
      }

      // Update local state
      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? { ...agent, ...data } : agent
      ));

      toast({
        title: 'Агент обновлен',
        description: `Агент "${data.name}" успешно обновлен`,
      });

      return data;
    } catch (err) {
      console.error('Error updating agent:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast({
        title: 'Ошибка обновления агента',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  }, [user, toast]);

  // Delete an agent
  const deleteAgent = useCallback(async (agentId: string): Promise<void> => {
    if (!user) {
      throw new Error('Пользователь не авторизован');
    }

    try {
      const { error: deleteError } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentId)
        .eq('user_id', user.id); // Ensure user can only delete their own agents

      if (deleteError) {
        console.error('Error deleting agent:', deleteError);
        throw new Error(deleteError.message);
      }

      // Remove from local state
      setAgents(prev => prev.filter(agent => agent.id !== agentId));

      toast({
        title: 'Агент удален',
        description: 'Агент успешно удален',
      });
    } catch (err) {
      console.error('Error deleting agent:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast({
        title: 'Ошибка удаления агента',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  }, [user, toast]);

  // Get agent by ID
  const getAgentById = useCallback(async (agentId: string): Promise<Agent | null> => {
    if (!user) {
      return null;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('Error fetching agent:', fetchError);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Unexpected error fetching agent:', err);
      return null;
    }
  }, [user]);

  // Load agents when user changes
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return {
    agents,
    loading,
    error,
    createAgent,
    updateAgent,
    deleteAgent,
    getAgentById,
    loadAgents
  };
};