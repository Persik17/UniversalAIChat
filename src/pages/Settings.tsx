import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/hooks/useSettings';
import { 
  Settings as SettingsIcon, 
  Key, 
  Bot, 
  Shield, 
  Save, 
  Eye, 
  EyeOff,
  CheckCircle,
  AlertCircle,
  TestTube
} from 'lucide-react';

const Settings = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const { settings, loading: settingsLoading, saveSettings, updateSetting, testAPIKey } = useSettings();
  const [showKeys, setShowKeys] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Show loading spinner while checking auth
  if (loading || settingsLoading) {
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

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const result = await saveSettings(settings);
      
      if (result.success) {
        toast({
          title: "Настройки сохранены",
          description: "Ваши настройки успешно обновлены",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestAPIKey = async (provider: 'openai' | 'anthropic') => {
    setTesting(provider);
    try {
      const result = await testAPIKey(provider);
      toast({
        title: "API ключ работает",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Ошибка тестирования",
        description: error instanceof Error ? error.message : "Не удалось протестировать API ключ",
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  const getModelStatus = (enabled: boolean) => {
    return enabled ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        Активна
      </Badge>
    ) : (
      <Badge variant="secondary">
        <AlertCircle className="h-3 w-3 mr-1" />
        Неактивна
      </Badge>
    );
  };

  return (
    <div className="h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <SettingsIcon className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Настройки</h1>
                <p className="text-muted-foreground mt-1">
                  Настройте AI модели и API ключи для персонализации
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* AI Models Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    AI Модели
                  </CardTitle>
                  <CardDescription>
                    Выберите и настройте AI модели для различных задач
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* OpenAI */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">OpenAI GPT</h3>
                        <p className="text-sm text-muted-foreground">
                          Мощные языковые модели для общего использования
                        </p>
                      </div>
                      <Switch
                        checked={settings.openai.enabled}
                        onCheckedChange={(checked) => updateSetting('openai', 'enabled', checked)}
                      />
                    </div>
                    
                    {settings.openai.enabled && (
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="openai-key">API Ключ</Label>
                            <div className="relative">
                              <Input
                                id="openai-key"
                                type={showKeys ? "text" : "password"}
                                placeholder="sk-..."
                                value={settings.openai.apiKey}
                                onChange={(e) => updateSetting('openai', 'apiKey', e.target.value)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowKeys(!showKeys)}
                              >
                                {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="openai-model">Модель</Label>
                            <Select
                              value={settings.openai.model}
                              onValueChange={(value) => updateSetting('openai', 'model', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestAPIKey('openai')}
                            disabled={testing === 'openai'}
                          >
                            {testing === 'openai' ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                                Тестирование...
                              </>
                            ) : (
                              <>
                                <TestTube className="h-4 w-4 mr-2" />
                                Тестировать API ключ
                              </>
                            )}
                          </Button>
                          
                          {settings.openai.apiKey && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              <Key className="h-3 w-3 mr-1" />
                              Ключ установлен
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Anthropic */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Anthropic Claude</h3>
                        <p className="text-sm text-muted-foreground">
                          Claude для анализа и творческих задач
                        </p>
                      </div>
                      <Switch
                        checked={settings.anthropic.enabled}
                        onCheckedChange={(checked) => updateSetting('anthropic', 'enabled', checked)}
                      />
                    </div>
                    
                    {settings.anthropic.enabled && (
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="anthropic-key">API Ключ</Label>
                            <div className="relative">
                              <Input
                                id="anthropic-key"
                                type={showKeys ? "text" : "password"}
                                placeholder="sk-ant-..."
                                value={settings.anthropic.apiKey}
                                onChange={(e) => updateSetting('anthropic', 'apiKey', e.target.value)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowKeys(!showKeys)}
                              >
                                {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="anthropic-model">Модель</Label>
                            <Select
                              value={settings.anthropic.model}
                              onValueChange={(value) => updateSetting('anthropic', 'model', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                                <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
                                <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestAPIKey('anthropic')}
                            disabled={testing === 'anthropic'}
                          >
                            {testing === 'anthropic' ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                                Тестирование...
                              </>
                            ) : (
                              <>
                                <TestTube className="h-4 w-4 mr-2" />
                                Тестировать API ключ
                              </>
                            )}
                          </Button>
                          
                          {settings.anthropic.apiKey && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              <Key className="h-3 w-3 mr-1" />
                              Ключ установлен
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Local Models */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Локальные модели</h3>
                        <p className="text-sm text-muted-foreground">
                          Запуск моделей локально для приватности
                        </p>
                      </div>
                      <Switch
                        checked={settings.local.enabled}
                        onCheckedChange={(checked) => updateSetting('local', 'enabled', checked)}
                      />
                    </div>
                    
                    {settings.local.enabled && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="local-endpoint">Endpoint</Label>
                          <Input
                            id="local-endpoint"
                            placeholder="http://localhost:11434"
                            value={settings.local.endpoint}
                            onChange={(e) => updateSetting('local', 'endpoint', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="local-model">Модель</Label>
                          <Select
                            value={settings.local.model}
                            onValueChange={(value) => updateSetting('local', 'model', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="llama-3.1-8b">Llama 3.1 8B</SelectItem>
                              <SelectItem value="llama-3.1-70b">Llama 3.1 70B</SelectItem>
                              <SelectItem value="mistral-7b">Mistral 7B</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Security Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Безопасность
                  </CardTitle>
                  <CardDescription>
                    Настройки безопасности и приватности
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Локальное хранение ключей</h3>
                      <p className="text-sm text-muted-foreground">
                        API ключи хранятся только в вашем браузере
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      <Shield className="h-3 w-3 mr-1" />
                      Безопасно
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Шифрование данных</h3>
                      <p className="text-sm text-muted-foreground">
                        Все данные шифруются перед отправкой
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Включено
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="min-w-[120px]"
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Сохранить
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
