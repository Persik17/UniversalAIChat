import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Loader2, Trash2 } from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';

export const DocumentUpload = () => {
  const { documents, uploading, uploadDocument, summarizeDocument, deleteDocument } = useDocuments();
  const [summarizing, setSummarizing] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        await uploadDocument(file);
      } else {
        alert('Пожалуйста, загружайте только PDF файлы');
      }
    }
  }, [uploadDocument]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const handleSummarize = async (docId: string) => {
    setSummarizing(docId);
    try {
      await summarizeDocument(docId);
    } finally {
      setSummarizing(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Загрузка документов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            {isDragActive ? (
              <p className="text-lg">Отпустите файлы здесь...</p>
            ) : (
              <div>
                <p className="text-lg mb-2">
                  Перетащите PDF файлы сюда или нажмите для выбора
                </p>
                <p className="text-sm text-muted-foreground">
                  Поддерживаются PDF файлы до 500 страниц
                </p>
              </div>
            )}
          </div>
          
          {uploading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка и индексация документа...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents List */}
      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Мои документы</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{doc.file_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{doc.pages} страниц</span>
                        {doc.meta?.chunks_count && (
                          <Badge variant="secondary">
                            {doc.meta.chunks_count} фрагментов
                          </Badge>
                        )}
                        {doc.meta?.summary && (
                          <Badge variant="outline" className="text-green-600">
                            Суммаризирован
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!doc.meta?.summary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSummarize(doc.id)}
                        disabled={summarizing === doc.id}
                      >
                        {summarizing === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Суммаризировать'
                        )}
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDocument(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};