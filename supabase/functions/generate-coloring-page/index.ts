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
    const { prompt, action } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured. Please set it in your Supabase project secrets.');
    }

    console.log('Request received:', { action, prompt });

    if (action === 'imagine') {
      // Generate image using OpenRouter API with an image-capable model
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://instantart.lovable.app',
          'X-Title': 'Coloring Book Generator',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          modalities: ['image', 'text'],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', response.status, errorText);
        let message = 'Failed to generate image from OpenRouter.';
        if (response.status === 429) {
          message = 'Rate limit exceeded. Please try again in a moment.';
          return new Response(JSON.stringify({ error: message }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else if (response.status === 402) {
          message = 'Usage limit reached. Please add credits to your OpenRouter account.';
          return new Response(JSON.stringify({ error: message }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else if (response.status === 401) {
          message = 'Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY.';
        }
        return new Response(JSON.stringify({ error: message }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      console.log('OpenRouter response:', JSON.stringify(data).substring(0, 500));

      // Extract image from OpenRouter response
      const message = data.choices?.[0]?.message;
      let imageDataUrl: string | null = null;

      // Check for images array (standard OpenRouter image response)
      if (message?.images && message.images.length > 0) {
        imageDataUrl = message.images[0]?.image_url?.url || message.images[0]?.imageUrl?.url;
      }
      
      if (!imageDataUrl) {
        console.error('No image data in response from OpenRouter:', JSON.stringify(data));
        throw new Error('No image was generated. Please try a different prompt.');
      }

      return new Response(JSON.stringify({ 
        status: 'completed',
        imageUrl: imageDataUrl,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For status checks, since Hugging Face Inference API is synchronous, we don't need polling
    if (action === 'status') {
      return new Response(JSON.stringify({
        status: 'completed',
        progress: 100,
        imageUrl: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'upscale') {
      return new Response(JSON.stringify({ 
        error: 'Upscale is not available with this image generation model'
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
    console.error('Image generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});