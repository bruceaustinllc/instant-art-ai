import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validate that the caller is using the service role key
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader !== `Bearer ${supabaseServiceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { jobId, promptIndex = 0 } = await req.json();

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

    // Skip if already completed or failed
    if (job.status === "completed" || job.status === "failed") {
      return new Response(JSON.stringify({ message: "Job already finished" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompts = job.prompts as string[];
    
    // If this is the first call, mark as processing
    if (promptIndex === 0 && job.status === "pending") {
      await supabase
        .from("generation_jobs")
        .update({ status: "processing" })
        .eq("id", jobId);
    }

    // Check if we've processed all prompts
    if (promptIndex >= prompts.length) {
      // All done - mark completed
      await supabase
        .from("generation_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return new Response(JSON.stringify({ 
        success: true, 
        message: "All prompts processed",
        completedCount: job.completed_count,
        failedCount: job.failed_count,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = prompts[promptIndex];
    console.log(`Processing prompt ${promptIndex + 1}/${prompts.length}: ${prompt.substring(0, 50)}...`);

    // Get current max page number for this book
    const { data: existingPages } = await supabase
      .from("book_pages")
      .select("page_number")
      .eq("book_id", job.book_id)
      .order("page_number", { ascending: false })
      .limit(1);

    const currentPageNumber = (existingPages?.[0]?.page_number || 0) + 1;

    // Check for Cloudflare credentials first, then fallback to Lovable AI
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const useCloudflare = CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN;
    
    if (!useCloudflare && !LOVABLE_API_KEY) {
      throw new Error("No image generation API configured");
    }

    let imageUrl: string | null = null;
    let failed = false;

    try {
      if (useCloudflare) {
        imageUrl = await generateWithCloudflare(
          CLOUDFLARE_ACCOUNT_ID,
          CLOUDFLARE_API_TOKEN,
          prompt
        );
      } else {
        imageUrl = await generateWithLovableAI(LOVABLE_API_KEY!, prompt);
      }
    } catch (err) {
      console.error(`Generation error for prompt ${promptIndex}:`, err);
      failed = true;
    }

    // Update counts
    const newCompletedCount = failed ? job.completed_count : job.completed_count + 1;
    const newFailedCount = failed ? job.failed_count + 1 : job.failed_count;

    // Save the page if successful
    if (imageUrl && !failed) {
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
      }
    }

    // Update job progress
    await supabase
      .from("generation_jobs")
      .update({
        completed_count: newCompletedCount,
        failed_count: newFailedCount,
      })
      .eq("id", jobId);

    // Schedule next prompt processing using EdgeRuntime.waitUntil
    const nextPromptIndex = promptIndex + 1;
    
    if (nextPromptIndex < prompts.length) {
      // Use waitUntil to process next prompt in background after returning
      const functionUrl = `${supabaseUrl}/functions/v1/process-generation-job`;
      
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      EdgeRuntime.waitUntil(
        (async () => {
          // Small delay to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          try {
            await fetch(functionUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ jobId, promptIndex: nextPromptIndex }),
            });
          } catch (err) {
            console.error("Failed to trigger next prompt:", err);
          }
        })()
      );
    } else {
      // Last prompt - mark as completed
      await supabase
        .from("generation_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        promptIndex,
        nextPromptIndex: nextPromptIndex < prompts.length ? nextPromptIndex : null,
        imageGenerated: !failed,
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
  const coloringPrompt = `black and white coloring page, clean line art, detailed illustration for adults: ${prompt}. Style: intricate patterns, precise outlines, no shading, no gradients, pure white background.`;

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
        negative_prompt: "color, colorful, shading, gradients, shadows, gray, filled areas",
        num_steps: 20,
        guidance: 7.5,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Cloudflare AI error:", response.status, errorText);
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
  const generationPrompt = `Create a black and white coloring page illustration for adults of: ${prompt}. Style: detailed line art with clean outlines. No shading, no gradients. Pure white background.`;

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
    throw new Error(`Lovable AI error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}
