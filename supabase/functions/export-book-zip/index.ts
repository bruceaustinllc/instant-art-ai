 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 import JSZip from "https://esm.sh/jszip@3.10.1";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type",
 };
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const authHeader = req.headers.get("Authorization");
     if (!authHeader?.startsWith("Bearer ")) {
       return new Response(JSON.stringify({ error: "Unauthorized" }), {
         status: 401,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 
     // Client for auth validation
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
 
     // Service client for storage operations
     const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
 
     const { bookId, bookTitle } = await req.json();
 
     if (!bookId) {
       return new Response(JSON.stringify({ error: "bookId is required" }), {
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     // Verify book belongs to user
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
 
     // Fetch all pages
     const { data: pages, error: pagesError } = await supabaseAuth
       .from("book_pages")
       .select("id, page_number, image_url")
       .eq("book_id", bookId)
       .order("page_number", { ascending: true });
 
     if (pagesError) {
       throw pagesError;
     }
 
     if (!pages || pages.length === 0) {
       return new Response(
         JSON.stringify({ error: "No pages to export" }),
         {
           status: 400,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         }
       );
     }
 
     console.log(`Creating ZIP for book ${bookId} with ${pages.length} pages`);
 
     // Create ZIP
     const zip = new JSZip();
     const safeTitle = (bookTitle || book.title || "coloring-book")
       .replace(/[^a-z0-9]/gi, "_")
       .substring(0, 30);
     const folder = zip.folder(safeTitle);
 
     if (!folder) {
       throw new Error("Failed to create folder in ZIP");
     }
 
     let addedCount = 0;
     for (const page of pages) {
       // Extract base64 data
       const base64Match = page.image_url?.match(
         /^data:image\/(\w+);base64,(.+)$/
       );
       if (base64Match) {
         const [, , base64Data] = base64Match;
         const shortId = page.id.split("-")[0];
         const filename = `${String(addedCount + 1).padStart(4, "0")}_${shortId}.png`;
         folder.file(filename, base64Data, { base64: true });
         addedCount++;
       }
     }
 
     console.log(`Added ${addedCount} images to ZIP`);
 
     // Generate ZIP blob
     const zipBlob = await zip.generateAsync({ type: "uint8array" });
 
     // Upload to storage
     const timestamp = Date.now();
     const storagePath = `exports/${userId}/${safeTitle}_${timestamp}.zip`;
 
     const { error: uploadError } = await supabaseService.storage
       .from("coloring-pages")
       .upload(storagePath, zipBlob, {
         contentType: "application/zip",
         upsert: true,
       });
 
     if (uploadError) {
       console.error("Upload error:", uploadError);
       throw uploadError;
     }
 
     // Get public URL
     const { data: urlData } = supabaseService.storage
       .from("coloring-pages")
       .getPublicUrl(storagePath);
 
     console.log(`ZIP uploaded to ${storagePath}`);
 
     return new Response(
       JSON.stringify({
         success: true,
         downloadUrl: urlData.publicUrl,
         filename: `${safeTitle}.zip`,
         pageCount: addedCount,
       }),
       {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       }
     );
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