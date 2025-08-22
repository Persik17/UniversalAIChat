import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, model = 'gpt-4o-mini', agent = 'assistant', history = [] } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Agent system prompts
    const agentPrompts = {
      assistant: 'Вы - универсальный AI-ассистент. Отвечайте полезно, дружелюбно и информативно на русском языке.',
      coder: 'Вы - эксперт-программист. Помогайте с кодом, объясняйте концепции программирования, предлагайте лучшие практики. Отвечайте на русском языке.',
      writer: 'Вы - профессиональный копирайтер и редактор. Помогайте создавать качественный контент, улучшать тексты, давать советы по написанию. Отвечайте на русском языке.',
      analyst: 'Вы - аналитик данных. Помогайте анализировать информацию, создавать выводы, объяснять тренды и закономерности. Отвечайте на русском языке.'
    };

    // Build conversation history
    const messages = [
      {
        role: 'system',
        content: agentPrompts[agent as keyof typeof agentPrompts] || agentPrompts.assistant
      },
      // Add recent history for context
      ...history.slice(-8).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    console.log('Sending request to OpenAI with:', { model, messagesCount: messages.length });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model === 'gpt-4' ? 'gpt-4o-mini' : model, // Use available model
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('OpenAI response received successfully');

    return new Response(JSON.stringify({ 
      response: aiResponse,
      model: model,
      agent: agent 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-with-ai function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      response: 'Извините, произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});