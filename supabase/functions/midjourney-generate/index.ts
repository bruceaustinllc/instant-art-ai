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
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Request received:', { action, prompt });

    if (action === 'imagine') {
      // Generate image using Lovable AI Gateway with Gemini image model
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [
            {
              role: 'user',
              content: prompt,
            }
          ],
          modalities: ['image', 'text'],
        }),
      });

      const data = await response.json();
      console.log('Lovable AI response status:', response.status);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
        if (response.status === 402) {
          throw new Error('Usage limit reached. Please add credits to continue.');
        }
        console.error('AI gateway error:', data);
        throw new Error(data.error?.message || 'Failed to generate image');
      }

      // Extract the image from the response
      const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (!imageData) {
        console.error('No image in response:', JSON.stringify(data));
        throw new Error('No image was generated. Please try a different prompt.');
      }

      // Return the image directly (it's already a data URL)
      return new Response(JSON.stringify({ 
        status: 'completed',
        imageUrl: imageData,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For status checks, since Lovable AI is synchronous, we don't need polling
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
