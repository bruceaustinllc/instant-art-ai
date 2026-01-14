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
    const HF_API_TOKEN = Deno.env.get('HF_API_TOKEN'); // New environment variable
    
    if (!HF_API_TOKEN) {
      throw new Error('HF_API_TOKEN is not configured. Please set it in your Supabase project secrets.');
    }

    console.log('Request received:', { action, prompt });

    if (action === 'imagine') {
      // Generate image using Hugging Face Inference API with a Stable Diffusion model
      const response = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          options: {
            wait_for_model: true, // Wait if the model is loading
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Hugging Face API error:', response.status, errorText);
        let message = 'Failed to generate image from Hugging Face.';
        if (response.status === 503) {
          message = 'Hugging Face model is currently loading or busy. Please try again in a moment.';
        } else if (response.status === 401) {
          message = 'Invalid Hugging Face API token. Please check your HF_API_TOKEN.';
        }
        return new Response(JSON.stringify({ error: message }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Hugging Face returns an image blob directly
      const imageBlob = await response.blob();
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(imageBlob);
      const imageDataUrl = await dataUrlPromise;
      
      if (!imageDataUrl) {
        console.error('No image data in response from Hugging Face.');
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