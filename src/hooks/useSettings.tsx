import { useState, useEffect, useCallback } from 'react';

export interface AISettings {
  openai: {
    apiKey: string;
    model: string;
    enabled: boolean;
  };
  anthropic: {
    apiKey: string;
    model: string;
    enabled: boolean;
  };
  local: {
    model: string;
    enabled: boolean;
    endpoint: string;
  };
}

const defaultSettings: AISettings = {
  openai: {
    apiKey: '',
    model: 'gpt-4o-mini',
    enabled: true
  },
  anthropic: {
    apiKey: '',
    model: 'claude-3-haiku-20240307',
    enabled: false
  },
  local: {
    model: 'llama-3.1-8b',
    enabled: false,
    endpoint: 'http://localhost:11434'
  }
};

export const useSettings = () => {
  const [settings, setSettings] = useState<AISettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Load settings from localStorage
  const loadSettings = useCallback(() => {
    try {
      const savedSettings = localStorage.getItem('ai-chat-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = useCallback(async (newSettings: AISettings) => {
    try {
      localStorage.setItem('ai-chat-settings', JSON.stringify(newSettings));
      setSettings(newSettings);
      return { success: true };
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  // Update a specific setting
  const updateSetting = useCallback((provider: keyof AISettings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value
      }
    }));
  }, []);

  // Get active AI provider
  const getActiveProvider = useCallback(() => {
    if (settings.openai.enabled && settings.openai.apiKey) {
      return { provider: 'openai', model: settings.openai.model, apiKey: settings.openai.apiKey };
    }
    if (settings.anthropic.enabled && settings.anthropic.apiKey) {
      return { provider: 'anthropic', model: settings.anthropic.model, apiKey: settings.anthropic.apiKey };
    }
    if (settings.local.enabled) {
      return { provider: 'local', model: settings.local.model, endpoint: settings.local.endpoint };
    }
    return null;
  }, [settings]);

  // Test API key
  const testAPIKey = useCallback(async (provider: 'openai' | 'anthropic') => {
    const apiKey = settings[provider].apiKey;
    if (!apiKey) {
      throw new Error('API ключ не установлен');
    }

    try {
      if (provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('API ключ недействителен');
        }
        
        return { success: true, message: 'OpenAI API ключ работает' };
      }
      
      if (provider === 'anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'test' }]
          })
        });
        
        if (!response.ok) {
          throw new Error('API ключ недействителен');
        }
        
        return { success: true, message: 'Anthropic API ключ работает' };
      }
    } catch (error) {
      throw error;
    }
  }, [settings]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    saveSettings,
    updateSetting,
    getActiveProvider,
    testAPIKey,
    loadSettings
  };
};
