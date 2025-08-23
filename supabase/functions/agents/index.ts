import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const agentId = pathParts[pathParts.length - 1];

    switch (req.method) {
      case 'GET':
        if (agentId && agentId !== 'agents') {
          // Get single agent
          const { data: agent, error } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .eq('user_id', user.id)
            .single();

          if (error) {
            throw new Error(`Agent not found: ${error.message}`);
          }

          return new Response(JSON.stringify(agent), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Get all agents
          const { data: agents, error } = await supabase
            .from('agents')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) {
            throw new Error(`Failed to fetch agents: ${error.message}`);
          }

          return new Response(JSON.stringify(agents || []), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      case 'POST':
        if (url.pathname.includes('/feedback')) {
          // Agent feedback/learning
          const { agentId, correction } = await req.json();
          
          if (!agentId || !correction) {
            throw new Error('agentId and correction are required');
          }

          // Get current agent
          const { data: agent, error: getError } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .eq('user_id', user.id)
            .single();

          if (getError || !agent) {
            throw new Error('Agent not found');
          }

          // Append learning to prompt
          const updatedPrompt = agent.system_prompt + `\n\n#learned: ${correction}`;

          const { data: updatedAgent, error: updateError } = await supabase
            .from('agents')
            .update({ system_prompt: updatedPrompt })
            .eq('id', agentId)
            .eq('user_id', user.id)
            .select()
            .single();

          if (updateError) {
            throw new Error(`Failed to update agent: ${updateError.message}`);
          }

          return new Response(JSON.stringify({
            success: true,
            agent: updatedAgent
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Create new agent
          const { name, role = 'assistant', model = 'gpt-4o-mini', system_prompt } = await req.json();

          if (!name || !system_prompt) {
            throw new Error('name and system_prompt are required');
          }

          const { data: agent, error } = await supabase
            .from('agents')
            .insert({
              user_id: user.id,
              name,
              role,
              model,
              system_prompt
            })
            .select()
            .single();

          if (error) {
            throw new Error(`Failed to create agent: ${error.message}`);
          }

          return new Response(JSON.stringify(agent), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      case 'PATCH':
        // Update agent
        const updateData = await req.json();
        const allowedFields = ['name', 'role', 'model', 'system_prompt'];
        const filteredData = Object.keys(updateData)
          .filter(key => allowedFields.includes(key))
          .reduce((obj, key) => {
            obj[key] = updateData[key];
            return obj;
          }, {} as any);

        if (Object.keys(filteredData).length === 0) {
          throw new Error('No valid fields to update');
        }

        const { data: updatedAgent, error: patchError } = await supabase
          .from('agents')
          .update(filteredData)
          .eq('id', agentId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (patchError) {
          throw new Error(`Failed to update agent: ${patchError.message}`);
        }

        return new Response(JSON.stringify(updatedAgent), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'DELETE':
        // Delete agent
        const { error: deleteError } = await supabase
          .from('agents')
          .delete()
          .eq('id', agentId)
          .eq('user_id', user.id);

        if (deleteError) {
          throw new Error(`Failed to delete agent: ${deleteError.message}`);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        throw new Error(`Method ${req.method} not allowed`);
    }

  } catch (error) {
    console.error('Error in agents function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});