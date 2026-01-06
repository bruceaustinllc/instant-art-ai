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

    // Using GoAPI Midjourney API (most reliable third-party service)
    const baseUrl = 'https://api.goapi.ai/mj/v2';

    if (action === 'imagine') {
      // Generate new image
      const response = await fetch(`${baseUrl}/imagine`, {
        method: 'POST',
        headers: {
          'X-API-Key': MIDJOURNEY_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          process_mode: 'fast',
          webhook_endpoint: '',
          webhook_secret: '',
        }),
      });

      const data = await response.json();
      console.log('Imagine response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start image generation');
      }

      return new Response(JSON.stringify({ 
        taskId: data.task_id,
        status: 'processing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      // Check task status
      const response = await fetch(`${baseUrl}/fetch`, {
        method: 'POST',
        headers: {
          'X-API-Key': MIDJOURNEY_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId,
        }),
      });

      const data = await response.json();
      console.log('Status response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch task status');
      }

      return new Response(JSON.stringify({
        status: data.status,
        progress: data.progress || 0,
        imageUrl: data.task_result?.image_url || null,
        buttons: data.task_result?.actions || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'upscale') {
      // Upscale an image
      const { button } = await req.json();
      
      const response = await fetch(`${baseUrl}/action`, {
        method: 'POST',
        headers: {
          'X-API-Key': MIDJOURNEY_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId,
          action: button,
        }),
      });

      const data = await response.json();
      console.log('Upscale response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to upscale image');
      }

      return new Response(JSON.stringify({ 
        taskId: data.task_id,
        status: 'processing'
      }), {
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
