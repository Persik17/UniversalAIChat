import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, model, provider, apiKey, chatId, agentId, intent, confidence } = await req.json()

    if (!message || !model || !provider || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let aiResponse: string
    let usage: any = null

    // Route to appropriate AI provider
    switch (provider) {
      case 'openai':
        const openaiResult = await callOpenAI(message, model, apiKey)
        aiResponse = openaiResult.response
        usage = openaiResult.usage
        break
        
      case 'anthropic':
        const anthropicResult = await callAnthropic(message, model, apiKey)
        aiResponse = anthropicResult.response
        usage = anthropicResult.usage
        break
        
      case 'local':
        const localResult = await callLocalModel(message, model, apiKey)
        aiResponse = localResult.response
        usage = localResult.usage
        break
        
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    // Save message to database if chatId is provided
    if (chatId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      )

      // Save user message
      await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          content: message,
          role: 'user',
          sender: 'user',
          model: model,
          msg_type: 'text',
          meta: {},
          agent_id: agentId || null,
          intent: intent || null,
          confidence: confidence || null
        })

      // Save AI response
      await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          content: aiResponse,
          role: 'assistant',
          sender: 'ai',
          model: model,
          msg_type: 'text',
          meta: { usage, provider },
          agent_id: agentId || null,
          intent: intent || null,
          confidence: confidence || null
        })
    }

    return new Response(
      JSON.stringify({ 
        response: aiResponse, 
        usage,
        provider,
        model 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in chat-with-ai:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function callOpenAI(message: string, model: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: message }],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
  }

  const data = await response.json()
  return {
    response: data.choices[0].message.content,
    usage: data.usage
  }
}

async function callAnthropic(message: string, model: string, apiKey: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1000,
      messages: [{ role: 'user', content: message }],
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`)
  }

  const data = await response.json()
  return {
    response: data.content[0].text,
    usage: {
      input_tokens: data.usage?.input_tokens,
      output_tokens: data.usage?.output_tokens
    }
  }
}

async function callLocalModel(message: string, model: string, endpoint: string) {
  // This is a placeholder for local model integration
  // You would typically call your local Ollama or similar service
  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      prompt: message,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`Local model error: ${response.statusText}`)
  }

  const data = await response.json()
  return {
    response: data.response,
    usage: {
      input_tokens: data.prompt_eval_count,
      output_tokens: data.eval_count
    }
  }
}