import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { useDocuments } from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Trash2, Eye } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

const Documents = () => {
  const { user, loading } = useAuth();
  const { documents, loading: docsLoading, deleteDocument } = useDocuments();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-lg font-medium">Загрузка...</span>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleDelete = async (docId: string) => {
    try {
      setDeletingId(docId);
      await deleteDocument(docId);
      toast({
        title: "Документ удален",
        description: "Документ успешно удален из системы",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить документ",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Документы</h1>
                <p className="text-muted-foreground mt-2">
                  Загружайте и управляйте PDF документами для RAG функциональности
                </p>
              </div>
            </div>

            {/* Upload Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Загрузка документов</CardTitle>
                <CardDescription>
                  Загрузите PDF документы для анализа и поиска по содержимому
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentUpload />
              </CardContent>
            </Card>

            {/* Documents List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Ваши документы</h2>
                <Badge variant="secondary">
                  {documents.length} документ{documents.length !== 1 ? 'ов' : ''}
                </Badge>
              </div>

              {docsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Загрузка документов...</span>
                  </div>
                </div>
              ) : documents.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">
                      Документы не найдены
                    </h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      Загрузите свой первый PDF документ, чтобы начать использовать RAG функциональность
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {documents.map((doc) => (
                    <Card key={doc.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            <CardTitle className="text-base truncate">
                              {doc.file_name}
                            </CardTitle>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {doc.pages || 0} стр.
                          </Badge>
                        </div>
                        <CardDescription className="text-sm">
                          Загружен {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                          <span>Размер: {formatFileSize(doc.meta?.file_size || 0)}</span>
                          <span>Тип: PDF</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              // TODO: Implement document preview
                              toast({
                                title: "Предварительный просмотр",
                                description: "Функция просмотра в разработке",
                              });
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Просмотр
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              // TODO: Implement document download
                              toast({
                                title: "Скачивание",
                                description: "Функция скачивания в разработке",
                              });
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Скачать
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(doc.id)}
                            disabled={deletingId === doc.id}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documents;