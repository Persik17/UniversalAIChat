import React from 'react';
import { DocumentUpload } from '@/components/documents/DocumentUpload';

export default function Documents() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Документы</h1>
        <p className="text-muted-foreground">
          Загружайте PDF документы для RAG поиска и суммаризации
        </p>
      </div>
      
      <DocumentUpload />
    </div>
  );
}