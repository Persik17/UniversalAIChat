import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import ChatInterface from '@/components/chat/ChatInterface';
import { Bot, Sparkles } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <div className="flex items-center gap-2">
          <Bot className="h-8 w-8 animate-spin text-primary" />
          <span className="text-lg font-medium">Загрузка...</span>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  );
};

export default Index;
