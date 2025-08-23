import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Document {
  id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  pages: number;
  meta: any;
  created_at: string;
}

export const useDocuments = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load documents
  const loadDocuments = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить документы",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Upload document
  const uploadDocument = async (file: File) => {
    if (!user) return null;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);

      const { data, error } = await supabase.functions.invoke('rag-upload', {
        body: formData
      });

      if (error) {
        throw error;
      }

      await loadDocuments();
      
      toast({
        title: "Успешно",
        description: `Документ "${file.name}" загружен и проиндексирован`,
      });

      return data;
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить документ",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Summarize document
  const summarizeDocument = async (docId: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.functions.invoke('pdf-summarize', {
        body: { docId }
      });

      if (error) {
        throw error;
      }

      await loadDocuments();
      
      toast({
        title: "Успешно",
        description: "Документ суммаризирован",
      });

      return data;
    } catch (error) {
      console.error('Error summarizing document:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось суммаризировать документ",
        variant: "destructive",
      });
      return null;
    }
  };

  // Delete document
  const deleteDocument = async (docId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      await loadDocuments();
      
      toast({
        title: "Успешно",
        description: "Документ удален",
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить документ",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user]);

  return {
    documents,
    loading,
    uploading,
    uploadDocument,
    summarizeDocument,
    deleteDocument,
    loadDocuments
  };
};