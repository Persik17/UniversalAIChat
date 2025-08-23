import React from 'react';
import { VoiceInterface } from '@/components/voice/VoiceInterface';

export default function Voice() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Голосовые функции</h1>
        <p className="text-muted-foreground">
          Синтез речи через ElevenLabs API
        </p>
      </div>
      
      <VoiceInterface />
    </div>
  );
}