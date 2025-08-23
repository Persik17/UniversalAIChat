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
    const { docId } = await req.json();

    if (!docId) {
      throw new Error('docId is required');
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

    // Get document and its chunks
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    const { data: chunks, error: chunksError } = await supabase
      .from('doc_chunks')
      .select('content, page')
      .eq('doc_id', docId)
      .eq('user_id', user.id)
      .order('page');

    if (chunksError || !chunks || chunks.length === 0) {
      throw new Error('No content found for document');
    }

    console.log(`Summarizing ${chunks.length} chunks for document: ${document.file_name}`);

    // Group chunks by page for better summarization
    const pageGroups: { [key: number]: string[] } = {};
    chunks.forEach(chunk => {
      if (!pageGroups[chunk.page]) {
        pageGroups[chunk.page] = [];
      }
      pageGroups[chunk.page].push(chunk.content);
    });

    // Summarize each page (map phase)
    const pageSummaries = [];
    for (const [page, contents] of Object.entries(pageGroups)) {
      const pageContent = contents.join('\n\n');
      
      const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-2025-08-07',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at summarizing document pages. Create a concise but comprehensive summary of the main points, key information, and important details from the given text. Focus on preserving the most important information while being concise.'
            },
            {
              role: 'user',
              content: `Please summarize this page content:\n\n${pageContent}`
            }
          ],
          max_completion_tokens: 500
        }),
      });

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        const pageSummary = summaryData.choices[0].message.content;
        pageSummaries.push(`Page ${page}: ${pageSummary}`);
      } else {
        console.error(`Failed to summarize page ${page}`);
        pageSummaries.push(`Page ${page}: [Summary failed]`);
      }
    }

    // Create final summary (reduce phase)
    const combinedSummaries = pageSummaries.join('\n\n');
    
    const finalSummaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating executive summaries. Given page-by-page summaries of a document, create a comprehensive final summary that captures the main themes, key points, and overall message of the entire document. Structure it clearly with main sections and bullet points where appropriate.'
          },
          {
            role: 'user',
            content: `Create a final comprehensive summary based on these page summaries:\n\n${combinedSummaries}`
          }
        ],
        max_completion_tokens: 1000
      }),
    });

    let finalSummary = 'Summary generation failed';
    if (finalSummaryResponse.ok) {
      const finalData = await finalSummaryResponse.json();
      finalSummary = finalData.choices[0].message.content;
    }

    // Save summary to document metadata
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        meta: {
          ...document.meta,
          summary: finalSummary,
          page_summaries: pageSummaries,
          summarized_at: new Date().toISOString()
        }
      })
      .eq('id', docId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to save summary:', updateError);
    }

    console.log('Document summarization completed successfully');

    return new Response(JSON.stringify({
      success: true,
      summary: finalSummary,
      pages_processed: Object.keys(pageGroups).length,
      chunks_processed: chunks.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in pdf-summarize function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});