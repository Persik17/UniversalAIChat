import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Volume2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const VOICES = [
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', description: 'American, Calm' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'American, Confident' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'American, Soft' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'American, Upbeat' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Australian, Casual' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'British, Warm' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'American, Young' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'English, Elegant' }
];

export const VoiceInterface = () => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const generateSpeech = async () => {
    if (!text.trim()) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, введите текст для озвучивания",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('tts', {
        body: {
          text: text.trim(),
          voiceId: selectedVoice
        }
      });

      if (error) {
        throw error;
      }

      // Create audio blob from base64
      const audioData = data.audioData;
      const byteCharacters = atob(audioData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const audioBlob = new Blob([byteArray], { type: 'audio/mpeg' });
      
      // Create URL for audio playback
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      toast({
        title: "Успешно",
        description: "Аудио сгенерировано",
      });
    } catch (error) {
      console.error('Error generating speech:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сгенерировать речь",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const playAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
        toast({
          title: "Ошибка",
          description: "Не удалось воспроизвести аудио",
          variant: "destructive",
        });
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Синтез речи
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice Selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Выберите голос
          </label>
          <Select value={selectedVoice} onValueChange={setSelectedVoice}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите голос" />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map(voice => (
                <SelectItem key={voice.id} value={voice.id}>
                  <div>
                    <div className="font-medium">{voice.name}</div>
                    <div className="text-sm text-muted-foreground">{voice.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Text Input */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Текст для озвучивания
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Введите текст, который хотите озвучить..."
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={generateSpeech}
          disabled={isGenerating || !text.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Генерация речи...
            </>
          ) : (
            <>
              <Volume2 className="mr-2 h-4 w-4" />
              Сгенерировать речь
            </>
          )}
        </Button>

        {/* Audio Player */}
        {audioUrl && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Сгенерированное аудио:</span>
              <Button variant="outline" size="sm" onClick={playAudio}>
                <Volume2 className="mr-2 h-4 w-4" />
                Воспроизвести
              </Button>
            </div>
            <audio
              controls
              src={audioUrl}
              className="w-full"
              onEnded={() => {
                // Cleanup URL when audio ends
                URL.revokeObjectURL(audioUrl);
              }}
            />
          </div>
        )}

        {/* Info */}
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
          <p className="font-medium mb-1">Возможности:</p>
          <ul className="space-y-1 text-xs">
            <li>• Поддержка множества голосов и языков</li>
            <li>• Высококачественный синтез речи через ElevenLabs</li>
            <li>• Мгновенная генерация и воспроизведение</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};