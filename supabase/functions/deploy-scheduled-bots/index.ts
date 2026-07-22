import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date().toISOString();
    const { data: dueBots, error } = await supabase
      .from("bots")
      .select("*")
      .eq("status", "READY_TO_DEPLOY")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", now);
    if (error) throw error;
    if (!dueBots || dueBots.length === 0)
      return new Response(JSON.stringify({ deployed: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const endpoint = Deno.env.get("MEETINGBOT_ENDPOINT");
    const apiKey = Deno.env.get("BOT_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    let deployed = 0;
    for (const bot of dueBots) {
      try {
        if (!endpoint || !apiKey) continue;
        const callbackUrl = `${supabaseUrl}/functions/v1/bot-callback`;
        const response = await fetch(`${endpoint}/api/bots`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({ userId: bot.user_id, meetingTitle: bot.meeting_title, meetingInfo: bot.meeting_info, callbackUrl }),
        });
        if (response.ok) {
          await supabase.from("bots").update({ status: "DEPLOYING", started_at: now }).eq("id", bot.id);
          deployed++;
        }
      } catch { /* continue */ }
    }
    return new Response(JSON.stringify({ deployed, total: dueBots.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
