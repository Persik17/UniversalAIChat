import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  chat_type: string;
  document_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  content: string;
  role: string;
  sender: string;
  model?: string;
  msg_type: string;
  meta: Json;
  agent_id?: string | null;
  intent?: string | null;
  confidence?: number | null;
  created_at: string;
}

export interface CreateChatData {
  title: string;
  chat_type?: string;
  document_ids?: string[];
}

export interface UpdateChatData {
  title?: string;
  chat_type?: string;
  document_ids?: string[];
}

export const useChats = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load chats for the current user
  const loadChats = useCallback(async () => {
    if (!user) {
      setChats([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching chats:', fetchError);
        setError(fetchError.message);
        toast({
          title: 'Ошибка загрузки чатов',
          description: fetchError.message,
          variant: 'destructive',
        });
        return;
      }

      setChats(data || []);
    } catch (err) {
      console.error('Unexpected error loading chats:', err);
      setError('Неожиданная ошибка при загрузке чатов');
      toast({
        title: 'Ошибка загрузки чатов',
        description: 'Неожиданная ошибка при загрузке чатов',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Create a new chat
  const createChat = useCallback(async (chatData: CreateChatData): Promise<Chat> => {
    if (!user) {
      throw new Error('Пользователь не авторизован');
    }

    try {
      const { data, error: insertError } = await supabase
        .from('chats')
        .insert({
          ...chatData,
          user_id: user.id,
          chat_type: chatData.chat_type || 'general',
          document_ids: chatData.document_ids || []
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating chat:', insertError);
        throw new Error(insertError.message);
      }

      if (!data) {
        throw new Error('Чат не был создан');
      }

      // Add to local state
      setChats(prev => [data, ...prev]);

      toast({
        title: 'Чат создан',
        description: `Чат "${chatData.title}" успешно создан`,
      });

      return data;
    } catch (err) {
      console.error('Error creating chat:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast({
        title: 'Ошибка создания чата',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  }, [user, toast]);

  // Update an existing chat
  const updateChat = useCallback(async (chatId: string, updateData: UpdateChatData): Promise<Chat> => {
    if (!user) {
      throw new Error('Пользователь не авторизован');
    }

    try {
      const { data, error: updateError } = await supabase
        .from('chats')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId)
        .eq('user_id', user.id) // Ensure user can only update their own chats
        .select()
        .single();

      if (updateError) {
        console.error('Error updating chat:', updateError);
        throw new Error(updateError.message);
      }

      if (!data) {
        throw new Error('Чат не найден');
      }

      // Update local state
      setChats(prev => prev.map(chat => 
        chat.id === chatId ? { ...chat, ...data } : chat
      ));

      toast({
        title: 'Чат обновлен',
        description: `Чат "${data.title}" успешно обновлен`,
      });

      return data;
    } catch (err) {
      console.error('Error updating chat:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast({
        title: 'Ошибка обновления чата',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  }, [user, toast]);

  // Delete a chat
  const deleteChat = useCallback(async (chatId: string): Promise<void> => {
    if (!user) {
      throw new Error('Пользователь не авторизован');
    }

    try {
      const { error: deleteError } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId)
        .eq('user_id', user.id); // Ensure user can only delete their own chats

      if (deleteError) {
        console.error('Error deleting chat:', deleteError);
        throw new Error(deleteError.message);
      }

      // Remove from local state
      setChats(prev => prev.filter(chat => chat.id !== chatId));

      toast({
        title: 'Чат удален',
        description: 'Чат успешно удален',
      });
    } catch (err) {
      console.error('Error deleting chat:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast({
        title: 'Ошибка удаления чата',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  }, [user, toast]);

  // Get messages for a specific chat
  const getChatMessages = useCallback(async (chatId: string): Promise<Message[]> => {
    if (!user) {
      return [];
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Error fetching messages:', fetchError);
        toast({
          title: 'Ошибка загрузки сообщений',
          description: fetchError.message,
          variant: 'destructive',
        });
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Unexpected error fetching messages:', err);
      toast({
        title: 'Ошибка загрузки сообщений',
        description: 'Неожиданная ошибка при загрузке сообщений',
        variant: 'destructive',
      });
      return [];
    }
  }, [user, toast]);

  // Add a message to a chat
  const addMessage = useCallback(async (chatId: string, messageData: Omit<Message, 'id' | 'created_at'>): Promise<Message> => {
    if (!user) {
      throw new Error('Пользователь не авторизован');
    }

    try {
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          ...messageData,
          chat_id: chatId
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error adding message:', insertError);
        throw new Error(insertError.message);
      }

      if (!data) {
        throw new Error('Сообщение не было добавлено');
      }

      // Update chat's updated_at timestamp
      await updateChat(chatId, {});

      return data;
    } catch (err) {
      console.error('Error adding message:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast({
        title: 'Ошибка добавления сообщения',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  }, [user, toast, updateChat]);

  // Load chats when user changes
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  return {
    chats,
    loading,
    error,
    createChat,
    updateChat,
    deleteChat,
    getChatMessages,
    addMessage,
    loadChats
  };
};
