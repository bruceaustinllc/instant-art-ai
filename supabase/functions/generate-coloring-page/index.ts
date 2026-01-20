import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Upstream = {
  provider: "lovable" | "openrouter";
  resp: Response;
};

async function callLovable(prompt: string, LOVABLE_API_KEY: string): Promise<Upstream> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  return { provider: "lovable", resp };
}

async function callOpenRouter(prompt: string, OPENROUTER_API_KEY: string): Promise<Upstream> {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://instantart.lovable.app",
      "X-Title": "Coloring Book Generator",
    },
    body: JSON.stringify({
      // Image-capable model on OpenRouter
      model: "black-forest-labs/flux.1-schnell",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  return { provider: "openrouter", resp };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, action } = await req.json();

    console.log("Request received:", { action, prompt });

    if (action === "imagine") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured.");

      const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";

      // 1) Try Lovable AI first
      let upstream = await callLovable(String(prompt ?? ""), LOVABLE_API_KEY);

      // 2) If Lovable credits exhausted, fall back to OpenRouter if available
      if (!upstream.resp.ok && upstream.resp.status === 402 && OPENROUTER_API_KEY) {
        console.log("Lovable AI returned 402; falling back to OpenRouter");
        upstream = await callOpenRouter(String(prompt ?? ""), OPENROUTER_API_KEY);
      }

      if (!upstream.resp.ok) {
        const errorText = await upstream.resp.text();
        console.error(
          "Image generation upstream error:",
          upstream.provider,
          upstream.resp.status,
          errorText,
        );

        // Surface rate limit / payment errors explicitly so the frontend can show a friendly message.
        if (upstream.resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (upstream.resp.status === 402) {
          const msg =
            upstream.provider === "openrouter"
              ? "Usage limit reached on OpenRouter. Please add credits to your OpenRouter account."
              : "Usage limit reached. Please add credits to your workspace.";

          return new Response(JSON.stringify({ error: msg }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Generic error
        return new Response(JSON.stringify({ error: "Failed to generate image." }), {
          status: upstream.resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await upstream.resp.json();
      console.log("Upstream response:", upstream.provider, JSON.stringify(data).substring(0, 500));

      const message = data.choices?.[0]?.message;
      const imageUrl: string | undefined = message?.images?.[0]?.image_url?.url;

      if (!imageUrl) {
        console.error("No image data in response:", upstream.provider, JSON.stringify(data));
        throw new Error("No image was generated. Please try a different prompt.");
      }

      return new Response(
        JSON.stringify({
          status: "completed",
          imageUrl,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Synchronous: no polling needed.
    if (action === "status") {
      return new Response(
        JSON.stringify({
          status: "completed",
          progress: 100,
          imageUrl: null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "upscale") {
      return new Response(JSON.stringify({ error: "Upscale is not available with this model" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Image generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
