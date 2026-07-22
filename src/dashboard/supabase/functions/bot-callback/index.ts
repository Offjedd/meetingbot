import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { botId, status, recordingUrl, eventType, eventData } = body;

    if (!botId || !status) {
      return new Response(
        JSON.stringify({ error: "botId and status are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const update: Record<string, unknown> = { status };
    if (recordingUrl) update.recording_url = recordingUrl;
    if (status === "IN_CALL" || status === "DEPLOYING") {
      update.last_heartbeat = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("bots")
      .update(update)
      .eq("id", botId);

    if (updateError) throw updateError;

    if (eventType || status) {
      await supabase.from("bot_events").insert({
        bot_id: botId,
        event_type: eventType ?? status,
        event_data: eventData ?? null,
        event_time: new Date().toISOString(),
      });
    }

    if (status === "DONE" && recordingUrl) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (supabaseUrl && anonKey) {
        await fetch(`${supabaseUrl}/functions/v1/youtube-upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ botId }),
        }).catch(() => {});
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
