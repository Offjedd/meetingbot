import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const endpoint = Deno.env.get("MEETINGBOT_ENDPOINT");
    const apiKey = Deno.env.get("BOT_API_KEY");
    if (!endpoint || !apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing MEETINGBOT_ENDPOINT or BOT_API_KEY secret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const backendPath = url.searchParams.get("path");
    if (!backendPath) {
      return new Response(
        JSON.stringify({ error: "Missing 'path' query parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const backendUrl = `${endpoint}${backendPath}`;
    const res = await fetch(backendUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
