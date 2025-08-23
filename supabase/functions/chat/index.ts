import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chatId, messages, model = 'gpt-5-2025-08-07', agentId, useRag = false } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error('Messages array is required');
    }

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    let systemPrompt = 'You are a helpful AI assistant.';
    let ragContext = '';

    // Get agent if specified
    if (agentId) {
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('user_id', user.id)
        .single();

      if (!agentError && agent) {
        systemPrompt = agent.system_prompt || systemPrompt;
      }
    }

    // Get RAG context if enabled
    if (useRag && messages.length > 0) {
      const lastMessage = messages[messages.length - 1].content;
      
      // Create embedding for the query
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: lastMessage,
        }),
      });

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        const queryEmbedding = embeddingData.data[0].embedding;

        // Search for relevant chunks
        const { data: chunks, error: searchError } = await supabase
          .rpc('match_doc_chunks', {
            query_embedding: JSON.stringify(queryEmbedding),
            match_count: 5,
            in_user_id: user.id
          });

        if (!searchError && chunks && chunks.length > 0) {
          ragContext = `\n\nRelevant context from documents:\n${chunks.map(chunk => chunk.content).join('\n---\n')}`;
        }
      }
    }

    // Build conversation with system prompt and RAG context
    const conversationMessages = [
      {
        role: 'system',
        content: systemPrompt + ragContext
      },
      ...messages.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

    console.log(`Sending request to OpenAI with model: ${model}, messages: ${conversationMessages.length}`);

    // Determine API parameters based on model
    const isNewModel = ['gpt-5-2025-08-07', 'gpt-5-mini-2025-08-07', 'gpt-5-nano-2025-08-07', 'gpt-4.1-2025-04-14', 'o3-2025-04-16', 'o4-mini-2025-04-16'].includes(model);
    
    const requestBody: any = {
      model,
      messages: conversationMessages,
    };

    if (isNewModel) {
      requestBody.max_completion_tokens = 1000;
      // No temperature for new models
    } else {
      requestBody.max_tokens = 1000;
      requestBody.temperature = 0.7;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Save messages to database if chatId provided
    if (chatId) {
      // Save user message
      const userMessage = messages[messages.length - 1];
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender: 'user',
        content: userMessage.content,
        model,
        meta: { agent_id: agentId, used_rag: useRag }
      });

      // Save AI response
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender: 'agent',
        content: aiResponse,
        model,
        meta: { agent_id: agentId, used_rag: useRag, rag_context: ragContext ? 'yes' : 'no' }
      });
    }

    console.log('Chat response generated successfully');

    return new Response(JSON.stringify({
      response: aiResponse,
      model,
      agent_id: agentId,
      used_rag: useRag
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: 'Извините, произошла ошибка при обработке вашего запроса.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});