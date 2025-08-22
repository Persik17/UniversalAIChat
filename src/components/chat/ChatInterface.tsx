import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Send, 
  Bot, 
  User, 
  Mic, 
  MicOff, 
  Settings, 
  Sparkles,
  Brain,
  Zap,
  FileText,
  Upload
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'agent';
  content: string;
  timestamp: Date;
  agent?: string;
}

const ChatInterface = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [selectedAgent, setSelectedAgent] = useState('assistant');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load initial welcome message
  useEffect(() => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Привет! Я ваш Universal AI Chat. Я могу помочь вам с любыми вопросами, создать контент, проанализировать документы и многое другое. Что бы вы хотели обсудить?',
        timestamp: new Date(),
      }
    ]);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call OpenAI edge function
      const { data, error } = await supabase.functions.invoke('chat-with-ai', {
        body: {
          message: input.trim(),
          model: selectedModel,
          agent: selectedAgent,
          history: messages.slice(-10), // Last 10 messages for context
        }
      });

      if (error) {
        throw error;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: selectedAgent === 'assistant' ? 'assistant' : 'agent',
        content: data.response || 'Извините, произошла ошибка при генерации ответа.',
        timestamp: new Date(),
        agent: selectedAgent,
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить сообщение. Проверьте настройки API.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    toast({
      title: isRecording ? 'Запись остановлена' : 'Запись начата',
      description: 'Голосовой ввод пока в разработке',
    });
  };

  const models = [
    { id: 'gpt-4', name: 'GPT-4', icon: Brain, status: 'active' },
    { id: 'claude', name: 'Claude', icon: Sparkles, status: 'coming' },
    { id: 'llama', name: 'LLaMA', icon: Zap, status: 'coming' },
  ];

  const agents = [
    { id: 'assistant', name: 'Ассистент', description: 'Универсальный помощник' },
    { id: 'coder', name: 'Программист', description: 'Эксперт по коду' },
    { id: 'writer', name: 'Писатель', description: 'Создание контента' },
    { id: 'analyst', name: 'Аналитик', description: 'Анализ данных' },
  ];

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-chat-background to-muted/20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <span className="font-semibold">Universal AI Chat</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {models.find(m => m.id === selectedModel)?.name}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {agents.find(a => a.id === selectedAgent)?.name}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => {
                  const Icon = model.icon;
                  return (
                    <SelectItem 
                      key={model.id} 
                      value={model.id}
                      disabled={model.status !== 'active'}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-3 w-3" />
                        <span>{model.name}</span>
                        {model.status !== 'active' && (
                          <Badge variant="secondary" className="text-xs">SOON</Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-xs text-muted-foreground">{agent.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role !== 'user' && (
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <Card className={`max-w-[70%] p-4 ${
                message.role === 'user' 
                  ? 'bg-chat-message-user text-white border-0' 
                  : message.role === 'agent'
                  ? 'bg-chat-message-agent text-white border-0'
                  : 'bg-chat-message-assistant border'
              }`}>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/10">
                  <span className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  {message.agent && (
                    <Badge variant="secondary" className="text-xs">
                      {agents.find(a => a.id === message.agent)?.name}
                    </Badge>
                  )}
                </div>
              </Card>

              {message.role === 'user' && (
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-muted">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 mt-1">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4 animate-pulse" />
                </AvatarFallback>
              </Avatar>
              <Card className="max-w-[70%] p-4 bg-chat-message-assistant border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-muted-foreground">Генерирую ответ...</span>
                </div>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-2">
            <Button variant="ghost" size="icon" className="mb-2">
              <Upload className="h-4 w-4" />
            </Button>
            
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Напишите сообщение... (Enter для отправки, Shift+Enter для новой строки)"
                className="min-h-[60px] max-h-32 resize-none pr-12"
                disabled={isLoading}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 bottom-2"
                onClick={toggleRecording}
              >
                {isRecording ? (
                  <MicOff className="h-4 w-4 text-destructive" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="mb-2 bg-gradient-to-r from-primary to-primary-glow hover:from-primary/90 hover:to-primary-glow/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>AI готов к общению</span>
            <span>{input.length}/4000 символов</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;