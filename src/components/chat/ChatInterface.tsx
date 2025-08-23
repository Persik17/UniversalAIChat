import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useChats } from '@/hooks/useChats';
import { useAgents } from '@/hooks/useAgents';
import { useIntentClassification } from '@/hooks/useIntentClassification';
import { useMultiAgentChat } from '@/hooks/useMultiAgentChat';
import { useContextSwitching } from '@/hooks/useContextSwitching';
import { useAdvancedIntentClassification } from '@/hooks/useAdvancedIntentClassification';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AgentFeedback } from './AgentFeedback';
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
  Upload,
  Users,
  MessageSquare,
  Play
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';
import { Json } from '@/integrations/supabase/types';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'agent';
  content: string;
  timestamp: Date;
  agent?: string;
  agent_id?: string;
  intent?: string;
  confidence?: number;
}

const ChatInterface = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const chatId = searchParams.get('chat') || null;
  
  // Hooks
  const { chats, getChatMessages, addMessage, updateChat } = useChats();
  const { agents: availableAgents, getAgentById } = useAgents();
  const { classifyIntent, saveIntentClassification } = useIntentClassification();
  const { startAgentConversation, getConversationByChatId } = useMultiAgentChat();
  const { analyzeContextSwitch, executeContextSwitch, currentContext } = useContextSwitching();
  const { autoRouteMessage } = useAdvancedIntentClassification();
  const { settings, getActiveProvider } = useSettings();
  
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [currentChat, setCurrentChat] = useState<any>(null);
  const [chatType, setChatType] = useState<string>('general');
  const [isRAGEnabled, setIsRAGEnabled] = useState(false);
  const [multiAgentMode, setMultiAgentMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat messages when chatId changes
  useEffect(() => {
    const loadChatMessages = async (chatId: string) => {
      try {
        const chatMessages = await getChatMessages(chatId);
        const formattedMessages: Message[] = chatMessages.map(msg => ({
          id: msg.id,
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: new Date(msg.created_at),
          agent_id: msg.agent_id || undefined,
          intent: msg.intent || undefined,
          confidence: msg.confidence || undefined
        }));
        
        setMessages(formattedMessages);
        
        // Get chat info
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
          setCurrentChat(chat);
          setChatType(chat.chat_type || 'general');
        }
      } catch (error) {
        console.error('Failed to load chat messages:', error);
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить сообщения чата',
          variant: 'destructive',
        });
      }
    };

    if (chatId) {
      loadChatMessages(chatId);
    } else {
      // Load initial welcome message for new chat
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: 'Привет! Я ваш Universal AI Chat. Я могу помочь вам с любыми вопросами, создать контент, проанализировать документы и многое другое. Что бы вы хотели обсудить?',
          timestamp: new Date(),
        }
      ]);
    }
  }, [chatId, getChatMessages, chats, toast]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Get active provider for API calls
    const activeProvider = getActiveProvider();
    if (!activeProvider) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, настройте API ключи в настройках",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Initialize variables for intent classification
    let intent = 'general';
    let confidence = 0.5;
    let agentId: string | null = null;

    try {
      // Add user message to chat
      const userMessageData = {
        chat_id: chatId,
        content: userMessage,
        role: 'user',
        sender: 'user',
        meta: {},
        model: selectedModel,
        msg_type: 'text',
        agent_id: selectedAgent || null,
        intent: intent,
        confidence: confidence
      };

      // Add user message to database
      if (chatId) {
        await addMessage(chatId, userMessageData);
      }

      // Analyze context switching and auto-route message
      try {
        if (chatId) {
          const contextResult = await analyzeContextSwitch(input.trim(), chatId, currentContext || undefined);

          if (contextResult.shouldSwitch) {
            await executeContextSwitch(chatId, contextResult);
            if (contextResult.newContext === 'rag') {
              setIsRAGEnabled(true);
            }
            if (contextResult.suggestedAgent) {
              setSelectedAgent(contextResult.suggestedAgent);
            }
          }

          const routingResult = await autoRouteMessage(input.trim(), chatId);
          intent = routingResult.intentResult.intent;
          confidence = routingResult.intentResult.confidence;
          agentId = routingResult.intentResult.suggestedAgentId;

          if (routingResult.autoResponse) {
            toast({
              title: "Автоматическая маршрутизация",
              description: routingResult.autoResponse,
            });
          }
        } else {
          // Fallback to basic intent classification if no chat ID
          if (availableAgents.length > 0) {
            const intentResult = await classifyIntent(input.trim(), availableAgents);
            intent = intentResult.intent;
            confidence = intentResult.confidence;
            agentId = intentResult.suggestedAgentId;
          }
        }
      } catch (error) {
        console.error('Context switching or intent classification failed:', error);
        // Fallback to basic classification
        if (availableAgents.length > 0) {
          const intentResult = await classifyIntent(input.trim(), availableAgents);
          intent = intentResult.intent;
          confidence = intentResult.confidence;
          agentId = intentResult.suggestedAgentId;
        }
      }

      // Determine which API to call based on mode
      let aiResponse: string;
      let responseMeta: Record<string, unknown> = {};

      if (multiAgentMode) {
        // Start multi-agent conversation
        if (chatId) {
          await startAgentConversation(chatId, [selectedAgent], userMessage, 5);
        }
        aiResponse = 'Мульти-агентный разговор начат';
        responseMeta = { type: 'multi-agent' };
      } else if (isRAGEnabled || chatType === 'rag') {
        // Use RAG for document-based responses
        const result = await supabase.functions.invoke('rag-upload', {
          body: {
            query: userMessage,
            chatId: chatId,
            model: selectedModel,
            provider: activeProvider.provider,
            apiKey: activeProvider.apiKey
          }
        });
        
        if (result.error) throw new Error(result.error.message);
        aiResponse = result.data.response;
        responseMeta = { type: 'rag', documents: result.data.documents };
      } else {
        // Regular AI chat
        const result = await supabase.functions.invoke('chat-with-ai', {
          body: {
            message: userMessage,
            model: selectedModel,
            provider: activeProvider.provider,
            apiKey: activeProvider.apiKey,
            chatId: chatId,
            agentId: selectedAgent,
            intent: intent,
            confidence: confidence
          }
        });
        
        if (result.error) throw new Error(result.error.message);
        aiResponse = result.data.response;
        responseMeta = { 
          type: 'chat', 
          usage: result.data.usage,
          provider: result.data.provider 
        };
      }

      // Add AI response to database
      if (chatId) {
        const aiMessageData = {
          chat_id: chatId,
          content: aiResponse,
          role: 'assistant',
          sender: 'ai',
          meta: responseMeta as unknown as Json,
          model: selectedModel,
          msg_type: 'text',
          agent_id: selectedAgent || null,
          intent: intent,
          confidence: confidence
        };

        await addMessage(chatId, aiMessageData);
      }

      // Update chat type if needed
      if (chatId && chatType !== 'rag' && isRAGEnabled) {
        await updateChat(chatId, { chat_type: 'rag' });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      if (chatId) {
        const errorMessageData = {
          chat_id: chatId,
          content: 'Извините, произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз.',
          role: 'assistant',
          sender: 'system',
          meta: { error: true, message: error instanceof Error ? error.message : 'Unknown error' } as unknown as Json,
          model: selectedModel,
          msg_type: 'text',
          agent_id: null,
          intent: null,
          confidence: null
        };

        await addMessage(chatId, errorMessageData);
      }

      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось отправить сообщение",
        variant: "destructive",
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

  // Update models array to use settings
  const models = [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' },
    { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', provider: 'local' },
    { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', provider: 'local' },
    { id: 'mistral-7b', name: 'Mistral 7B', provider: 'local' }
  ];

  // Filter models based on enabled providers
  const availableModels = models.filter(model => {
    if (model.provider === 'openai') return settings.openai.enabled;
    if (model.provider === 'anthropic') return settings.anthropic.enabled;
    if (model.provider === 'local') return settings.local.enabled;
    return false;
  });

  // Используем реальных агентов из базы данных
  const agentOptions = availableAgents.map(agent => ({
    id: agent.id,
    name: agent.name,
    description: agent.description || 'AI агент',
    role: agent.role || 'assistant'
  }));

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
                {agentOptions.find(a => a.id === selectedAgent)?.name || 'No Agent'}
              </Badge>
              {chatType && (
                <Badge variant="outline" className="text-xs">
                  {chatType === 'rag' ? 'RAG' : chatType === 'multi_agent' ? 'Multi-Agent' : chatType === 'support' ? 'Support' : 'General'}
                </Badge>
              )}
            </div>
            {chatId && availableAgents.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const topic = prompt('Введите тему для разговора агентов:');
                    if (topic) {
                      const agentIds = availableAgents.slice(0, 2).map(a => a.id);
                      await startAgentConversation(chatId, agentIds, topic, 5);
                      toast({
                        title: 'Разговор агентов запущен',
                        description: `Агенты обсуждают тему: "${topic}"`,
                      });
                    }
                  } catch (error) {
                    toast({
                      title: 'Ошибка',
                      description: 'Не удалось запустить разговор агентов',
                      variant: 'destructive',
                    });
                  }
                }}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Start Agent Conversation
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Model Selection */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Модель:</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => {
                    const Icon = model.provider === 'anthropic' ? Sparkles : model.provider === 'local' ? Zap : Brain;
                    return (
                      <SelectItem 
                        key={model.id} 
                        value={model.id}
                        disabled={model.provider === 'anthropic' && !settings.anthropic.enabled}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-3 w-3" />
                          <div className="flex flex-col">
                            <span className="font-medium">{model.name}</span>
                            <span className="text-xs text-muted-foreground">{model.provider}</span>
                          </div>
                          {model.provider === 'anthropic' && !settings.anthropic.enabled && (
                            <Badge variant="secondary" className="text-xs">SOON</Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Agent Selection */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Агент:</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Выберите агента" />
                </SelectTrigger>
                <SelectContent>
                  {agentOptions.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{agent.name}</span>
                          <Badge variant="outline" className="text-xs">{agent.role}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{agent.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* RAG Toggle */}
            <div className="flex items-center gap-2">
              <Label htmlFor="rag-toggle" className="text-sm font-medium">RAG:</Label>
              <Switch
                id="rag-toggle"
                checked={isRAGEnabled}
                onCheckedChange={setIsRAGEnabled}
              />
            </div>

            {/* Multi-Agent Toggle */}
            <div className="flex items-center gap-2">
              <Label htmlFor="multi-agent-toggle" className="text-sm font-medium">Multi-Agent:</Label>
              <Switch
                id="multi-agent-toggle"
                checked={multiAgentMode}
                onCheckedChange={setMultiAgentMode}
              />
            </div>

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
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                    {/* Agent Feedback for assistant messages */}
                    {message.role === 'assistant' && message.agent_id && (
                      <AgentFeedback
                        agentId={message.agent_id}
                        agentName={availableAgents.find(a => a.id === message.agent_id)?.name || 'AI Assistant'}
                        messageId={message.id}
                        messageContent={message.content}
                        onFeedbackSubmitted={() => {
                          // Optional: refresh messages or show success
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {message.agent_id && (
                      <Badge variant="secondary" className="text-xs">
                        {availableAgents.find(a => a.id === message.agent_id)?.name || 'Agent'}
                      </Badge>
                    )}
                    {message.intent && (
                      <Badge variant="outline" className="text-xs">
                        {message.intent}
                      </Badge>
                    )}
                  </div>
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