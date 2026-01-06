import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, action, taskId } = await req.json();
    const MIDJOURNEY_API_KEY = Deno.env.get('MIDJOURNEY_API_KEY');
    
    if (!MIDJOURNEY_API_KEY) {
      throw new Error('MIDJOURNEY_API_KEY is not configured');
    }

    console.log('Request received:', { action, prompt, taskId });

    // Using Legnext AI API (replacement for GoAPI)
    const baseUrl = 'https://api.legnext.ai/api';

    if (action === 'imagine') {
      // Generate new image
      const response = await fetch(`${baseUrl}/v1/diffusion`, {
        method: 'POST',
        headers: {
          'x-api-key': MIDJOURNEY_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: prompt,
        }),
      });

      const data = await response.json();
      console.log('Imagine response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start image generation');
      }

      return new Response(JSON.stringify({ 
        taskId: data.job_id,
        status: 'processing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      // Check task status using Legnext task endpoint
      const response = await fetch(`${baseUrl}/v1/task/${taskId}`, {
        method: 'GET',
        headers: {
          'x-api-key': MIDJOURNEY_API_KEY,
        },
      });

      const data = await response.json();
      console.log('Status response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch task status');
      }

      // Map Legnext status to our format
      let status = data.status;
      if (status === 'completed' || status === 'success') {
        status = 'completed';
      } else if (status === 'failed' || status === 'error') {
        status = 'failed';
      } else {
        status = 'processing';
      }

      return new Response(JSON.stringify({
        status: status,
        progress: data.status === 'completed' ? 100 : 50,
        imageUrl: data.output?.image_url || null,
        buttons: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'upscale') {
      // Legnext may have different upscale endpoint - for now return not supported
      return new Response(JSON.stringify({ 
        error: 'Upscale not yet implemented for Legnext API'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Midjourney API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
