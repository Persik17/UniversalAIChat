import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useChats } from '@/hooks/useChats';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Plus,
  Sparkles,
  FileText,
  Brain,
  Zap,
  Trash2
} from 'lucide-react';

const Sidebar = () => {
  const { user, signOut } = useAuth();
  const { chats, createChat, deleteChat } = useChats();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigation = [
    { 
      name: 'Чаты', 
      href: '/chat', 
      icon: MessageSquare, 
      current: location.pathname === '/' || location.pathname === '/chat',
      description: 'Диалоги с AI агентами'
    },
    { 
      name: 'Агенты', 
      href: '/agents', 
      icon: Bot, 
      current: location.pathname === '/agents',
      description: 'Управление AI агентами'
    },
    { 
      name: 'Документы', 
      href: '/documents', 
      icon: FileText, 
      current: location.pathname === '/documents',
      description: 'RAG документы и знания'
    },
    { 
      name: 'Настройки', 
      href: '/settings', 
      icon: Settings, 
      current: location.pathname === '/settings',
      description: 'API ключи и конфигурация'
    },
  ];

  const features = [
    { name: 'GPT-4', icon: Brain, status: 'active' },
    { name: 'Claude', icon: Sparkles, status: 'coming' },
    { name: 'LLaMA', icon: Zap, status: 'coming' },
  ];

  return (
    <div className={`bg-sidebar border-r border-sidebar-border flex flex-col h-full transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bot className="h-8 w-8 text-sidebar-primary" />
            <Sparkles className="h-3 w-3 text-accent absolute -top-1 -right-1" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-bold text-sidebar-foreground">Universal AI</h1>
              <p className="text-xs text-sidebar-foreground/60">Chat Platform</p>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <Button 
          className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"
          size={isCollapsed ? "icon" : "default"}
          onClick={async () => {
            try {
              const newChat = await createChat('Новый чат');
              navigate(`/?chat=${newChat.id}`);
            } catch (error) {
              console.error('Failed to create chat:', error);
            }
          }}
        >
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Новый чат</span>}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Navigation */}
        <div className="px-4 py-2">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                    item.current
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-xs text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80">
                        {item.description}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        <Separator className="mx-4 my-4" />

        {/* AI Models */}
        {!isCollapsed && (
          <div className="px-4 py-2">
            <h3 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
              AI Модели
            </h3>
            <div className="space-y-1">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.name}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-sidebar-foreground/80"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3 w-3" />
                      <span className="text-xs">{feature.name}</span>
                    </div>
                    <Badge 
                      variant={feature.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs px-1 py-0"
                    >
                      {feature.status === 'active' ? 'ON' : 'SOON'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Separator className="mx-4 my-4" />

        {/* Recent Chats */}
        {!isCollapsed && (
          <div className="px-4 py-2">
            <h3 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
              Недавние чаты
            </h3>
            <div className="space-y-1">
              {chats.slice(0, 5).map((chat) => (
                <div
                  key={chat.id}
                  className="group px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent/50 cursor-pointer"
                  onClick={() => navigate(`/?chat=${chat.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm truncate flex-1">{chat.title}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-sidebar-foreground/40 hover:text-sidebar-foreground/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-sidebar-foreground/40">
                    {new Date(chat.updated_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              ))}
              {chats.length === 0 && (
                <div className="px-3 py-2 text-sidebar-foreground/40 text-xs">
                  Нет чатов
                </div>
              )}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center">
            <span className="text-xs text-sidebar-primary-foreground font-bold">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.email || 'Пользователь'}
              </p>
              <p className="text-xs text-sidebar-foreground/60">Pro Account</p>
            </div>
          )}
        </div>
        <div className={`mt-3 flex gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
          <Button
            variant="ghost"
            size={isCollapsed ? "icon" : "sm"}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <Settings className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Настройки</span>}
          </Button>
          <Button
            variant="ghost"
            size={isCollapsed ? "icon" : "sm"}
            onClick={signOut}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Выйти</span>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;