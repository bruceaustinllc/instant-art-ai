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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured.');
    }

    console.log('Request received:', { action, prompt });

    if (action === 'imagine') {
      // Generate image using Lovable AI Gateway with image generation model
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image',
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
        console.error('Lovable AI Gateway error:', response.status, errorText);
        let message = 'Failed to generate image.';
        if (response.status === 429) {
          message = 'Rate limit exceeded. Please try again in a moment.';
          return new Response(JSON.stringify({ error: message }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else if (response.status === 402) {
          message = 'Usage limit reached. Please add credits to your workspace.';
          return new Response(JSON.stringify({ error: message }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: message }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      console.log('Lovable AI response:', JSON.stringify(data).substring(0, 500));

      // Extract image from Lovable AI response
      const message = data.choices?.[0]?.message;
      let imageDataUrl: string | null = null;

      // Check for images array (standard image response)
      if (message?.images && message.images.length > 0) {
        imageDataUrl = message.images[0]?.image_url?.url;
      }
      
      if (!imageDataUrl) {
        console.error('No image data in response:', JSON.stringify(data));
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