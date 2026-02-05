 // deno-lint-ignore-file no-explicit-any
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 import JSZip from "https://esm.sh/jszip@3.10.1";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type",
 };
 
// NOTE: book_pages.image_url currently stores base64 data URLs for many users.
// Decoding + uploading multiple pages in one invocation can exceed strict CPU limits,
// so we intentionally process 1 page per invocation.
const BATCH_SIZE = 1;
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 
   try {
     const body = await req.json();
     const { bookId, bookTitle, jobId, isInternalCall } = body;
 
      // Internal calls (background processing): require service-role auth
      if (isInternalCall) {
        const authHeader = req.headers.get("Authorization") || "";
        if (authHeader !== `Bearer ${supabaseServiceKey}`) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // External calls (user-initiated): require user auth
      if (!isInternalCall) {
       const authHeader = req.headers.get("Authorization");
       if (!authHeader?.startsWith("Bearer ")) {
         return new Response(JSON.stringify({ error: "Unauthorized" }), {
           status: 401,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
 
       const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
         global: { headers: { Authorization: authHeader } },
       });
 
       const { data: userData, error: userError } =
         await supabaseAuth.auth.getUser();
       if (userError || !userData?.user) {
         return new Response(JSON.stringify({ error: "Unauthorized" }), {
           status: 401,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
 
       const userId = userData.user.id;
 
       if (!bookId) {
         return new Response(JSON.stringify({ error: "bookId is required" }), {
           status: 400,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
 
       // Verify book belongs to user and get page count
       const { data: book, error: bookError } = await supabaseAuth
         .from("coloring_books")
         .select("id, title")
         .eq("id", bookId)
         .eq("user_id", userId)
         .single();
 
       if (bookError || !book) {
         return new Response(JSON.stringify({ error: "Book not found" }), {
           status: 404,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
 
       // Count pages
       const { count, error: countError } = await supabaseAuth
         .from("book_pages")
         .select("id", { count: "exact", head: true })
         .eq("book_id", bookId);
 
       if (countError) throw countError;
 
       if (!count || count === 0) {
         return new Response(
           JSON.stringify({ error: "No pages to export" }),
           {
             status: 400,
             headers: { ...corsHeaders, "Content-Type": "application/json" },
           }
         );
       }
 
       // Create export job
       const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
       const safeTitle = (bookTitle || book.title || "coloring-book")
         .replace(/[^a-z0-9]/gi, "_")
         .substring(0, 30);
 
       const { data: job, error: jobError } = await supabaseService
         .from("export_jobs")
         .insert({
           user_id: userId,
           book_id: bookId,
           book_title: safeTitle,
           status: "processing",
           total_pages: count,
           processed_pages: 0,
           current_offset: 0,
         })
         .select()
         .single();
 
       if (jobError) throw jobError;
 
       console.log(`Created export job ${job.id} for ${count} pages`);
 
        // Trigger first page processing via self-invoke
        await invokeNextBatch(job.id, supabaseUrl, supabaseAnonKey, supabaseServiceKey);
 
       return new Response(
         JSON.stringify({
           success: true,
           jobId: job.id,
           status: "processing",
           totalPages: count,
         }),
         {
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         }
       );
     }
 
     // Internal call - process next batch
     if (jobId) {
       await processNextBatch(jobId, supabaseUrl, supabaseServiceKey);
       return new Response(JSON.stringify({ success: true }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     return new Response(JSON.stringify({ error: "Invalid request" }), {
       status: 400,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error) {
     console.error("Export error:", error);
     return new Response(
       JSON.stringify({
         error: error instanceof Error ? error.message : "Export failed",
       }),
       {
         status: 500,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       }
     );
   }
 });
 
async function invokeNextBatch(
  jobId: string,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string
) {
  const functionUrl = `${supabaseUrl}/functions/v1/export-book-zip`;

  try {
    // Fire-and-forget (new invocation gets fresh CPU budget)
    fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Some environments expect an apikey header even when verify_jwt=false.
        apikey: anonKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ jobId, isInternalCall: true }),
    }).catch((err) => console.error("Self-invoke error:", err));
  } catch (error) {
    console.error("Failed to invoke next batch:", error);
  }
}

 async function processNextBatch(
   jobId: string,
   supabaseUrl: string,
   serviceKey: string
 ) {
   const supabase = createClient(supabaseUrl, serviceKey);
 
   try {
     // Get job details
     const { data: job, error: jobError } = await supabase
       .from("export_jobs")
       .select("*")
       .eq("id", jobId)
       .single();
 
     if (jobError || !job) {
       console.error("Job not found:", jobId);
       return;
     }
 
     if (job.status === "completed" || job.status === "failed") {
       console.log(`Job ${jobId} already ${job.status}`);
       return;
     }
 
     // Fetch batch of pages (only id to minimize data, then fetch image separately)
     const { data: pageIds, error: pagesError } = await supabase
       .from("book_pages")
       .select("id, page_number")
       .eq("book_id", job.book_id)
       .order("page_number", { ascending: true })
       .range(job.current_offset, job.current_offset + BATCH_SIZE - 1);
 
     if (pagesError) throw pagesError;
 
     if (!pageIds || pageIds.length === 0) {
       // All pages processed, create ZIP
       await finalizeExport(job, supabase);
       return;
     }
 
     console.log(
       `Processing batch at offset ${job.current_offset}, ${pageIds.length} pages`
     );
 
     // Fetch full image data for this batch only
     const { data: pages, error: fetchError } = await supabase
       .from("book_pages")
       .select("id, page_number, image_url")
       .in(
         "id",
         pageIds.map((p) => p.id)
       );
 
     if (fetchError) throw fetchError;
 
      // Store images temporarily in storage (1 page per invocation)
      let newOffset = job.current_offset;
      let newProcessed = job.processed_pages;

      for (const page of pages || []) {
       const base64Match = page.image_url?.match(
         /^data:image\/(\w+);base64,(.+)$/
       );
       if (base64Match) {
         const [, ext, base64Data] = base64Match;
         const binaryData = Uint8Array.from(atob(base64Data), (c) =>
           c.charCodeAt(0)
         );
         const shortId = page.id.split("-")[0];
         const filename = `${String(page.page_number).padStart(4, "0")}_${shortId}.png`;
         const storagePath = `export-temp/${jobId}/${filename}`;
 
          const { error: uploadError } = await supabase.storage
           .from("coloring-pages")
           .upload(storagePath, binaryData, {
             contentType: `image/${ext || "png"}`,
             upsert: true,
           });

          if (uploadError) throw uploadError;

          // Update progress immediately so UI doesn't stick at 0 if we time out later.
          newOffset += 1;
          newProcessed += 1;
          await supabase
            .from("export_jobs")
            .update({ current_offset: newOffset, processed_pages: newProcessed })
            .eq("id", jobId);
       }
     }

      // Self-invoke for next page (non-blocking)
      await invokeNextBatch(jobId, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, serviceKey);
   } catch (error) {
     console.error(`Export batch error for job ${jobId}:`, error);
     await supabase
       .from("export_jobs")
       .update({
         status: "failed",
         error_message:
           error instanceof Error ? error.message : "Export failed",
         completed_at: new Date().toISOString(),
       })
       .eq("id", jobId);
   }
 }
 
 async function finalizeExport(
   job: any,
   supabase: any
 ) {
   console.log(`Finalizing export for job ${job.id}`);
 
   try {
     // List all temp files
     const { data: files, error: listError } = await supabase.storage
       .from("coloring-pages")
       .list(`export-temp/${job.id}`);
 
     if (listError) throw listError;
 
     if (!files || files.length === 0) {
       throw new Error("No files to archive");
     }
 
     // Create ZIP
     const zip = new JSZip();
     const folder = zip.folder(job.book_title);
 
     if (!folder) throw new Error("Failed to create ZIP folder");
 
     // Download each file and add to ZIP
     for (const file of files) {
       const { data: fileData, error: downloadError } = await supabase.storage
         .from("coloring-pages")
         .download(`export-temp/${job.id}/${file.name}`);
 
       if (downloadError) {
         console.error(`Failed to download ${file.name}:`, downloadError);
         continue;
       }
 
       const arrayBuffer = await fileData.arrayBuffer();
       folder.file(file.name, arrayBuffer);
     }
 
     // Generate ZIP
     const zipBlob = await zip.generateAsync({ type: "uint8array" });
 
     // Upload final ZIP
     const timestamp = Date.now();
     const zipPath = `exports/${job.user_id}/${job.book_title}_${timestamp}.zip`;
 
     const { error: uploadError } = await supabase.storage
       .from("coloring-pages")
       .upload(zipPath, zipBlob, {
         contentType: "application/zip",
         upsert: true,
       });
 
     if (uploadError) throw uploadError;
 
     // Get public URL
     const { data: urlData } = supabase.storage
       .from("coloring-pages")
       .getPublicUrl(zipPath);
 
     // Update job as completed
     await supabase
       .from("export_jobs")
       .update({
         status: "completed",
         download_url: urlData.publicUrl,
         completed_at: new Date().toISOString(),
       })
       .eq("id", job.id);
 
     console.log(`Export completed: ${urlData.publicUrl}`);
 
     // Clean up temp files
     for (const file of files) {
       await supabase.storage
         .from("coloring-pages")
         .remove([`export-temp/${job.id}/${file.name}`]);
     }
   } catch (error) {
     console.error(`Finalize error for job ${job.id}:`, error);
     await supabase
       .from("export_jobs")
       .update({
         status: "failed",
         error_message:
           error instanceof Error ? error.message : "Failed to create ZIP",
         completed_at: new Date().toISOString(),
       })
       .eq("id", job.id);
   }
 }