import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Message {
  id: string;
  chat_id: string;
  sender: 'user' | 'agent';
  content: string;
  model?: string;
  meta?: any;
  created_at: string;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export const useChat = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load chats
  const loadChats = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading chats:', error);
      return;
    }

    setChats(data || []);
  };

  // Load messages for a chat
  const loadMessages = async (chatId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    setMessages((data as Message[]) || []);
  };

  // Create new chat
  const createChat = async (title: string) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: user.id,
        title
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating chat:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать чат",
        variant: "destructive",
      });
      return null;
    }

    await loadChats();
    return data;
  };

  // Send message
  const sendMessage = async (
    content: string, 
    options: {
      chatId?: string;
      model?: string;
      agentId?: string;
      useRag?: boolean;
    } = {}
  ) => {
    if (!user) return null;

    setLoading(true);

    try {
      let chatId = options.chatId || currentChat?.id;

      // Create new chat if none exists
      if (!chatId) {
        const newChat = await createChat(content.substring(0, 50) + '...');
        if (!newChat) {
          throw new Error('Failed to create chat');
        }
        chatId = newChat.id;
        setCurrentChat(newChat);
      }

      // Build messages array for the API
      const conversationMessages = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // Add current message
      conversationMessages.push({
        role: 'user',
        content
      });

      // Call chat function
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          chatId,
          messages: conversationMessages,
          model: options.model || 'gpt-5-2025-08-07',
          agentId: options.agentId,
          useRag: options.useRag || false
        }
      });

      if (error) {
        throw error;
      }

      // Reload messages to get the latest
      await loadMessages(chatId);
      await loadChats(); // Update chat list

      return data;

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить сообщение",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Select chat
  const selectChat = async (chat: Chat) => {
    setCurrentChat(chat);
    await loadMessages(chat.id);
  };

  // Delete chat
  const deleteChat = async (chatId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить чат",
        variant: "destructive",
      });
      return;
    }

    if (currentChat?.id === chatId) {
      setCurrentChat(null);
      setMessages([]);
    }

    await loadChats();
    
    toast({
      title: "Успешно",
      description: "Чат удален",
    });
  };

  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user]);

  return {
    chats,
    currentChat,
    messages,
    loading,
    createChat,
    sendMessage,
    selectChat,
    deleteChat,
    loadChats,
    loadMessages
  };
};