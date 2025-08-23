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

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string || file.name;

    if (!file) {
      throw new Error('File is required');
    }

    console.log(`Processing file: ${fileName}, size: ${file.size}`);

    // Upload file to storage
    const filePath = `${user.id}/${fileName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`File upload failed: ${uploadError.message}`);
    }

    // Extract text from PDF (simplified - in real app you'd use a proper PDF parser)
    const arrayBuffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(arrayBuffer);
    
    // Simple text chunking (800-1200 tokens with overlap)
    const chunks = chunkText(text, 1000, 200);
    
    console.log(`Created ${chunks.length} chunks for processing`);

    // Create document record
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        file_name: fileName,
        storage_path: filePath,
        pages: Math.ceil(chunks.length / 10), // Estimate pages
        meta: { chunks_count: chunks.length }
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Document creation failed: ${docError.message}`);
    }

    // Process chunks and create embeddings
    const embeddings = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Create embedding using OpenAI
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: chunk,
        }),
      });

      if (!embeddingResponse.ok) {
        console.error(`Embedding failed for chunk ${i}`);
        continue;
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      embeddings.push({
        doc_id: docData.id,
        user_id: user.id,
        page: Math.floor(i / 10) + 1,
        content: chunk,
        embedding: JSON.stringify(embedding)
      });
    }

    // Insert all chunks at once
    const { error: chunksError } = await supabase
      .from('doc_chunks')
      .insert(embeddings);

    if (chunksError) {
      console.error('Chunks insertion failed:', chunksError);
    }

    console.log(`Successfully processed ${embeddings.length} chunks`);

    return new Response(JSON.stringify({
      success: true,
      document: docData,
      chunks_processed: embeddings.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in rag-upload function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }
  
  return chunks;
}