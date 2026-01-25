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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];

      try {
        const generationPrompt = `Create a highly detailed, intricate black and white coloring page illustration for adults of: ${prompt}. 
Style: Ultra-detailed line art with precise, clean outlines. Include intricate patterns, fine details, and realistic proportions. 
No shading, no gradients, no filled solid areas - only outlines and patterns. Pure white background.
The design should fill the ENTIRE image edge-to-edge with no borders or margins.
Art style: Professional adult coloring book quality with zen-tangle inspired details and sophisticated artistic complexity.
Ultra high resolution.`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
          console.error(`Generation failed for prompt ${i}:`, resp.status, errorText);
          failedCount++;

          if (resp.status === 429 || resp.status === 402) {
            // Rate limit or usage limit - stop processing
            await supabase
              .from("generation_jobs")
              .update({
                status: "failed",
                completed_count: completedCount,
                failed_count: failedCount,
                error_message: resp.status === 402 ? "Usage limit reached" : "Rate limit exceeded",
              })
              .eq("id", jobId);

            // Send failure email
            await sendNotificationEmail(job.notify_email, job.book_id, completedCount, failedCount, true);

            return new Response(JSON.stringify({ error: "Rate or usage limit" }), {
              status: resp.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        }

        const data = await resp.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageUrl) {
          console.error(`No image in response for prompt ${i}`);
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

        // Delay between generations
        if (i < prompts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (err) {
        console.error(`Error processing prompt ${i}:`, err);
        failedCount++;
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

    // Send notification email
    await sendNotificationEmail(job.notify_email, job.book_id, completedCount, failedCount, false);

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

async function sendNotificationEmail(
  email: string | null,
  bookId: string,
  completedCount: number,
  failedCount: number,
  isFailed: boolean
) {
  if (!email) return;

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return;
  }

  try {
    const subject = isFailed
      ? `⚠️ Batch generation stopped - ${completedCount} pages completed`
      : `✅ Batch generation complete - ${completedCount} pages ready!`;

    const html = isFailed
      ? `
        <h1>Batch Generation Stopped</h1>
        <p>Your batch generation was interrupted due to rate limits or usage limits.</p>
        <p><strong>Completed:</strong> ${completedCount} pages</p>
        <p><strong>Failed:</strong> ${failedCount} pages</p>
        <p>Please check your account credits and try again later for the remaining pages.</p>
      `
      : `
        <h1>🎨 Your Coloring Pages Are Ready!</h1>
        <p>Great news! Your batch generation has completed successfully.</p>
        <p><strong>Generated:</strong> ${completedCount} pages</p>
        ${failedCount > 0 ? `<p><strong>Failed:</strong> ${failedCount} pages</p>` : ""}
        <p>Open the app to view and download your coloring book!</p>
      `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Coloring Book Creator <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Email send failed:", errorText);
    } else {
      console.log("Notification email sent to:", email);
    }
  } catch (err) {
    console.error("Email send error:", err);
  }
}
