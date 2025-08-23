import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Bot, 
  Plus, 
  Edit, 
  Trash2, 
  Brain,
  Code,
  PenTool,
  BarChart3,
  Sparkles,
  Settings,
  Activity,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useAgents } from '@/hooks/useAgents';
import { useToast } from '@/hooks/use-toast';

interface Agent {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  role: string;
  is_active: boolean;
  performance_metrics?: any;
  last_updated?: string;
  created_at: string;
}

const Agents = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const { agents, loading: agentsLoading, createAgent, updateAgent, deleteAgent } = useAgents();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
    role: 'assistant'
  });

  const agentIcons = {
    'Ассистент': Brain,
    'Программист': Code,
    'Писатель': PenTool,
    'Аналитик': BarChart3,
  };

  // Redirect to auth if not logged in
  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  if (loading || agentsLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <Bot className="h-8 w-8 animate-spin text-primary" />
    </div>;
  }

  const handleSave = async () => {
    try {
      if (!formData.name.trim() || !formData.system_prompt.trim()) {
        toast({
          title: 'Ошибка',
          description: 'Заполните все обязательные поля',
          variant: 'destructive',
        });
        return;
      }

      if (editingAgent) {
        // Update existing agent
        await updateAgent(editingAgent.id, {
          name: formData.name,
          description: formData.description,
          system_prompt: formData.system_prompt,
          role: formData.role
        });
        
        toast({
          title: 'Успешно',
          description: 'Агент обновлен',
        });
      } else {
        // Create new agent
        await createAgent({
          name: formData.name,
          description: formData.description,
          system_prompt: formData.system_prompt,
          role: formData.role
        });
        
        toast({
          title: 'Успешно',
          description: 'Агент создан',
        });
      }

      setIsDialogOpen(false);
      setEditingAgent(null);
      setFormData({ name: '', description: '', system_prompt: '', role: 'assistant' });
    } catch (error) {
      console.error('Error saving agent:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить агента',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Удалить агента "${agent.name}"?`)) return;

    try {
      await deleteAgent(agent.id);
      toast({ title: 'Успех', description: 'Агент удален' });
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить агента',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description,
      system_prompt: agent.system_prompt,
      role: agent.role || 'assistant'
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingAgent(null);
    setFormData({ name: '', description: '', system_prompt: '', role: 'assistant' });
    setIsDialogOpen(true);
  };

  const getAgentIcon = (name: string) => {
    const IconComponent = agentIcons[name as keyof typeof agentIcons] || Bot;
    return IconComponent;
  };

  return (
    <div className="h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI Агенты</h1>
              <p className="text-muted-foreground">Управляйте вашими персональными ассистентами</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} className="bg-gradient-to-r from-primary to-primary-glow">
                  <Plus className="h-4 w-4 mr-2" />
                  Создать агента
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingAgent ? 'Редактировать агента' : 'Создать нового агента'}
                  </DialogTitle>
                  <DialogDescription>
                    Настройте поведение и специализацию вашего AI-агента
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Название *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Например: Программист, Маркетолог, Аналитик"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Описание</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Краткое описание специализации агента"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Роль *</Label>
                    <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите роль агента" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assistant">Универсальный ассистент</SelectItem>
                        <SelectItem value="researcher">Исследователь</SelectItem>
                        <SelectItem value="support">Техническая поддержка</SelectItem>
                        <SelectItem value="coder">Программист</SelectItem>
                        <SelectItem value="writer">Писатель</SelectItem>
                        <SelectItem value="analyst">Аналитик</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="system_prompt">Системный промпт *</Label>
                    <Textarea
                      id="system_prompt"
                      value={formData.system_prompt}
                      onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                      placeholder="Детальное описание роли, навыков и стиля общения агента..."
                      className="min-h-[120px]"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Отмена
                    </Button>
                    <Button onClick={handleSave}>
                      {editingAgent ? 'Обновить' : 'Создать'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-6">
          {agentsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Bot className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {agents.map((agent) => {
                const IconComponent = getAgentIcon(agent.name);
                return (
                  <Card key={agent.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                                              <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <IconComponent className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{agent.name}</CardTitle>
                              <CardDescription className="text-sm">
                                {agent.description || 'Персональный ассистент'}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <Badge variant={agent.is_active ? "default" : "secondary"} className="text-xs">
                              {agent.is_active ? 'Активен' : 'Неактивен'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {agent.role || 'assistant'}
                            </Badge>
                          </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium mb-1">Системный промпт:</h4>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {agent.system_prompt}
                          </p>
                        </div>
                        
                        {/* Performance Metrics */}
                        {agent.performance_metrics && (
                          <div className="space-y-2 pt-2 border-t">
                            <h4 className="text-sm font-medium">Метрики производительности:</h4>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-green-500" />
                                <span>Точность: {Math.round((agent.performance_metrics?.accuracy || 0) * 100)}%</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-blue-500" />
                                <span>Время: {agent.performance_metrics?.response_time || 0}s</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Activity className="h-3 w-3 text-purple-500" />
                                <span>Оценка: {agent.performance_metrics?.user_satisfaction || 0}/5</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                              Создан: {new Date(agent.created_at).toLocaleDateString()}
                            </span>
                            {agent.last_updated && (
                              <span className="text-xs text-muted-foreground">
                                Обновлен: {new Date(agent.last_updated).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(agent)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(agent)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {agents.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12">
                  <Bot className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Пока нет агентов</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Создайте своего первого AI-агента для персонализированного общения
                  </p>
                  <Button onClick={openCreateDialog} className="bg-gradient-to-r from-primary to-primary-glow">
                    <Plus className="h-4 w-4 mr-2" />
                    Создать агента
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default Agents;