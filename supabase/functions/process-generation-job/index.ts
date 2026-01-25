import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(JSON.stringify({ error: "Missing jobId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the job
    const { data: job, error: jobError } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("Job fetch error:", jobError);
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.status !== "pending") {
      return new Response(JSON.stringify({ message: "Job already processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as processing
    await supabase
      .from("generation_jobs")
      .update({ status: "processing" })
      .eq("id", jobId);

    const prompts = job.prompts as string[];
    let completedCount = 0;
    let failedCount = 0;

    // Get current max page number for this book
    const { data: existingPages } = await supabase
      .from("book_pages")
      .select("page_number")
      .eq("book_id", job.book_id)
      .order("page_number", { ascending: false })
      .limit(1);

    let currentPageNumber = existingPages?.[0]?.page_number || 0;

    // Check for Cloudflare credentials first, then fallback to Lovable AI
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const useCloudflare = CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN;
    
    if (!useCloudflare && !LOVABLE_API_KEY) {
      throw new Error("No image generation API configured");
    }

    console.log(`Using ${useCloudflare ? "Cloudflare Workers AI" : "Lovable AI Gateway"} for generation`);

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];

      try {
        let imageUrl: string | null = null;

        if (useCloudflare) {
          // Use Cloudflare Workers AI
          imageUrl = await generateWithCloudflare(
            CLOUDFLARE_ACCOUNT_ID,
            CLOUDFLARE_API_TOKEN,
            prompt
          );
        } else {
          // Fallback to Lovable AI Gateway
          imageUrl = await generateWithLovableAI(LOVABLE_API_KEY!, prompt);
        }

        if (!imageUrl) {
          console.error(`No image generated for prompt ${i}`);
          failedCount++;
          continue;
        }

        // Save the page
        currentPageNumber++;
        const { error: insertError } = await supabase.from("book_pages").insert({
          book_id: job.book_id,
          user_id: job.user_id,
          page_number: currentPageNumber,
          prompt: prompt,
          image_url: imageUrl,
          art_style: "line_art",
        });

        if (insertError) {
          console.error("Page insert error:", insertError);
          failedCount++;
        } else {
          completedCount++;
        }

        // Update progress
        await supabase
          .from("generation_jobs")
          .update({
            completed_count: completedCount,
            failed_count: failedCount,
          })
          .eq("id", jobId);

        // Delay between generations (Cloudflare has better rate limits)
        if (i < prompts.length - 1) {
          const delay = useCloudflare ? 1000 : 2000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (err) {
        console.error(`Error processing prompt ${i}:`, err);
        failedCount++;

        // Check for rate limit errors
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("rate limit") || errMsg.includes("429") || errMsg.includes("402")) {
          await supabase
            .from("generation_jobs")
            .update({
              status: "failed",
              completed_count: completedCount,
              failed_count: failedCount,
              error_message: "Rate limit exceeded. Please try again later.",
            })
            .eq("id", jobId);

          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Mark as completed
    await supabase
      .from("generation_jobs")
      .update({
        status: "completed",
        completed_count: completedCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({
        success: true,
        completedCount,
        failedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Process job error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Generate image using Cloudflare Workers AI
 */
async function generateWithCloudflare(
  accountId: string,
  apiToken: string,
  prompt: string
): Promise<string | null> {
  const coloringPrompt = `black and white coloring page, clean line art, detailed illustration for adults: ${prompt}. Style: intricate patterns, precise outlines, no shading, no gradients, pure white background, zen-tangle inspired details.`;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: coloringPrompt,
        negative_prompt: "color, colorful, shading, gradients, shadows, gray, grey, filled areas, realistic photo",
        num_steps: 20,
        guidance: 7.5,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Cloudflare AI error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("rate limit exceeded");
    }
    throw new Error(`Cloudflare AI error: ${response.status}`);
  }

  // Cloudflare returns raw image bytes
  const imageBuffer = await response.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );
  
  return `data:image/png;base64,${base64}`;
}

/**
 * Generate image using Lovable AI Gateway (fallback)
 */
async function generateWithLovableAI(
  apiKey: string,
  prompt: string
): Promise<string | null> {
  const generationPrompt = `Create a highly detailed, intricate black and white coloring page illustration for adults of: ${prompt}. 
Style: Ultra-detailed line art with precise, clean outlines. Include intricate patterns, fine details, and realistic proportions. 
No shading, no gradients, no filled solid areas - only outlines and patterns. Pure white background.
The design should fill the ENTIRE image edge-to-edge with no borders or margins.
Art style: Professional adult coloring book quality with zen-tangle inspired details and sophisticated artistic complexity.
Ultra high resolution.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: generationPrompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error("Lovable AI error:", resp.status, errorText);
    
    if (resp.status === 429 || resp.status === 402) {
      throw new Error("rate limit exceeded");
    }
    throw new Error(`Lovable AI error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}
