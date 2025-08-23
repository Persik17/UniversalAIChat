import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  role: string;
}

interface ConversationState {
  currentTurn: number;
  maxTurns: number;
  agents: string[];
  topic: string;
  status: 'idle' | 'active' | 'completed' | 'error';
  messages: any[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { method } = req
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    switch (method) {
      case 'POST':
        if (action === 'start') {
          return await startMultiAgentConversation(req, supabaseClient)
        } else if (action === 'continue') {
          return await continueConversation(req, supabaseClient)
        } else if (action === 'end') {
          return await endConversation(req, supabaseClient)
        } else {
          return await processMultiAgentMessage(req, supabaseClient)
        }
      case 'GET':
        if (action === 'status') {
          return await getConversationStatus(req, supabaseClient)
        }
        break
      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in multi-agent-chat function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function startMultiAgentConversation(req: Request, supabase: any) {
  try {
    const { chatId, agentIds, topic, maxTurns = 5 } = await req.json()

    // Validate input
    if (!chatId || !agentIds || !Array.isArray(agentIds) || agentIds.length < 2) {
      return new Response(JSON.stringify({ error: 'Invalid input: chatId and at least 2 agentIds required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get agents information
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, name, system_prompt, role')
      .in('id', agentIds)

    if (agentsError || !agents || agents.length !== agentIds.length) {
      return new Response(JSON.stringify({ error: 'Failed to fetch agents' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create conversation record
    const initialState: ConversationState = {
      currentTurn: 0,
      maxTurns,
      agents: agentIds,
      topic,
      status: 'active',
      messages: []
    }

    const { data: conversation, error: convError } = await supabase
      .from('agent_conversations')
      .insert({
        chat_id: chatId,
        agent_ids: agentIds,
        conversation_state: initialState
      })
      .select()
      .single()

    if (convError) {
      return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update chat type
    await supabase
      .from('chats')
      .update({ chat_type: 'multi_agent' })
      .eq('id', chatId)

    // Start first agent turn
    const firstAgent = agents[0]
    const firstMessage = await generateAgentMessage(firstAgent, topic, [], 0)

    // Add first message to chat
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender: firstAgent.name,
        content: firstMessage,
        role: 'assistant',
        agent_id: firstAgent.id,
        intent: 'agent_conversation',
        confidence: 0.95,
        meta: { conversation_id: conversation.id },
        model: 'gpt-4o-mini',
        msg_type: 'text'
      })
      .select()
      .single()

    if (msgError) {
      console.error('Failed to add first message:', msgError)
    }

    return new Response(JSON.stringify({
      success: true,
      conversation_id: conversation.id,
      first_message: firstMessage,
      next_agent: agents[1]?.id,
      turn: 1
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error starting conversation:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function continueConversation(req: Request, supabase: any) {
  try {
    const { chatId, conversationId } = await req.json()

    // Get conversation state
    const { data: conversation, error: convError } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const state: ConversationState = conversation.conversation_state

    if (state.currentTurn >= state.maxTurns || state.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Conversation completed or max turns reached' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get next agent
    const nextAgentIndex = state.currentTurn % state.agents.length
    const nextAgentId = state.agents[nextAgentIndex]

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, system_prompt, role')
      .eq('id', nextAgentId)
      .single()

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get recent messages for context
    const { data: recentMessages, error: msgError } = await supabase
      .from('messages')
      .select('content, role, agent_id')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (msgError) {
      console.error('Failed to fetch recent messages:', msgError)
    }

    // Generate agent response
    const agentMessage = await generateAgentMessage(agent, state.topic, recentMessages || [], state.currentTurn)

    // Add message to chat
    const { data: message, error: addMsgError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender: agent.name,
        content: agentMessage,
        role: 'assistant',
        agent_id: agent.id,
        intent: 'agent_conversation',
        confidence: 0.95,
        meta: { conversation_id: conversationId },
        model: 'gpt-4o-mini',
        msg_type: 'text'
      })
      .select()
      .single()

    if (addMsgError) {
      console.error('Failed to add agent message:', addMsgError)
    }

    // Update conversation state
    const updatedState: ConversationState = {
      ...state,
      currentTurn: state.currentTurn + 1,
      messages: [...state.messages, {
        agentId: agent.id,
        agentName: agent.name,
        content: agentMessage,
        timestamp: new Date().toISOString()
      }]
    }

    await supabase
      .from('agent_conversations')
      .update({ conversation_state: updatedState })
      .eq('id', conversationId)

    // Check if conversation should continue
    const shouldContinue = updatedState.currentTurn < updatedState.maxTurns
    const nextAgent = shouldContinue ? state.agents[(updatedState.currentTurn) % state.agents.length] : null

    return new Response(JSON.stringify({
      success: true,
      agent_message: agentMessage,
      next_agent: nextAgent,
      turn: updatedState.currentTurn,
      should_continue: shouldContinue
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error continuing conversation:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function endConversation(req: Request, supabase: any) {
  try {
    const { conversationId } = await req.json()

    // Get conversation state
    const { data: conversation, error: convError } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const state: ConversationState = conversation.conversation_state

    // Update conversation status
    const finalState: ConversationState = {
      ...state,
      status: 'completed'
    }

    await supabase
      .from('agent_conversations')
      .update({ conversation_state: finalState })
      .eq('id', conversationId)

    // Add summary message
    const summary = `Разговор агентов завершен. Обсуждено ${state.messages.length} сообщений по теме "${state.topic}".`

    await supabase
      .from('messages')
      .insert({
        chat_id: conversation.chat_id,
        sender: 'System',
        content: summary,
        role: 'assistant',
        intent: 'conversation_summary',
        confidence: 1.0,
        meta: { conversation_id: conversationId, type: 'summary' },
        model: 'gpt-4o-mini',
        msg_type: 'text'
      })

    return new Response(JSON.stringify({
      success: true,
      summary,
      total_turns: state.currentTurn,
      total_messages: state.messages.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error ending conversation:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getConversationStatus(req: Request, supabase: any) {
  try {
    const url = new URL(req.url)
    const conversationId = url.searchParams.get('conversationId')

    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'conversationId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: conversation, error: convError } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      conversation: conversation
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error getting conversation status:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function processMultiAgentMessage(req: Request, supabase: any) {
  try {
    const { chatId, message, agentIds } = await req.json()

    // This function can be used for processing user messages in multi-agent chats
    // For now, we'll just return a success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Message processed for multi-agent chat'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error processing message:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function generateAgentMessage(agent: Agent, topic: string, context: any[], turn: number): Promise<string> {
  // In production, this would call an actual AI model
  // For now, we'll generate contextual responses based on agent role
  
  const contextSummary = context.length > 0 
    ? `Контекст: ${context.slice(-3).map(m => m.content).join(' | ')}`
    : ''

  let response = ''

  switch (agent.role) {
    case 'researcher':
      response = `Как исследователь, я анализирую тему "${topic}". ${contextSummary ? `Учитывая предыдущий контекст: ${contextSummary}` : ''} Позвольте мне предложить углубленный анализ и дополнительные источники информации.`
      break
    case 'support':
      response = `Как агент поддержки, я готов помочь с темой "${topic}". ${contextSummary ? `Основываясь на предыдущем обсуждении: ${contextSummary}` : ''} Что именно вас интересует или беспокоит?`
      break
    case 'coder':
      response = `Как программист, я готов помочь с техническими аспектами "${topic}". ${contextSummary ? `Учитывая контекст: ${contextSummary}` : ''} Могу предложить решения на уровне кода и архитектуры.`
      break
    case 'writer':
      response = `Как писатель, я помогу структурировать информацию по теме "${topic}". ${contextSummary ? `Исходя из предыдущего обсуждения: ${contextSummary}` : ''} Давайте создадим четкий и понятный контент.`
      break
    case 'analyst':
      response = `Как аналитик, я проанализирую тему "${topic}". ${contextSummary ? `На основе контекста: ${contextSummary}` : ''} Предложу структурированный анализ и выводы.`
      break
    default:
      response = `Как AI ассистент, я готов помочь с темой "${topic}". ${contextSummary ? `Учитывая предыдущий контекст: ${contextSummary}` : ''} Что именно вас интересует?`
  }

  if (turn > 0) {
    response += ` Это мой ${turn + 1}-й ход в нашем обсуждении.`
  }

  return response
}
