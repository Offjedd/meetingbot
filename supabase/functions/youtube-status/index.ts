const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const connected = !!Deno.env.get("YOUTUBE_REFRESH_TOKEN");
  return new Response(JSON.stringify({ connected }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
