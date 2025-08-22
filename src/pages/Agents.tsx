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
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Agent {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  created_at: string;
}

const Agents = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: ''
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <Bot className="h-8 w-8 animate-spin text-primary" />
    </div>;
  }

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error loading agents:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить агентов',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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
        const { error } = await supabase
          .from('agents')
          .update(formData)
          .eq('id', editingAgent.id);

        if (error) throw error;
        toast({ title: 'Успех', description: 'Агент обновлен' });
      } else {
        const { error } = await supabase
          .from('agents')
          .insert([formData]);

        if (error) throw error;
        toast({ title: 'Успех', description: 'Агент создан' });
      }

      setIsDialogOpen(false);
      setEditingAgent(null);
      setFormData({ name: '', description: '', system_prompt: '' });
      loadAgents();
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
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agent.id);

      if (error) throw error;
      toast({ title: 'Успех', description: 'Агент удален' });
      loadAgents();
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
      system_prompt: agent.system_prompt
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingAgent(null);
    setFormData({ name: '', description: '', system_prompt: '' });
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
          {isLoading ? (
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
                        <Badge variant="secondary" className="text-xs">
                          AI
                        </Badge>
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
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-xs text-muted-foreground">
                            {new Date(agent.created_at).toLocaleDateString()}
                          </span>
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