import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function refreshAccessToken(): Promise<string | null> {
  const clientId = Deno.env.get("YOUTUBE_CLIENT_ID");
  const clientSecret = Deno.env.get("YOUTUBE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("YOUTUBE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token as string;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  let botId: string | null = null;
  try {
    botId = (await req.json()).botId;
    if (!botId) return new Response(JSON.stringify({ error: "botId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: bot, error: botError } = await supabase.from("bots").select("*").eq("id", botId).single();
    if (botError || !bot) throw new Error("Bot not found");
    if (!bot.recording_url) throw new Error("No recording URL");

    await supabase.from("bots").update({ youtube_upload_status: "uploading" }).eq("id", botId);

    const endpoint = Deno.env.get("MEETINGBOT_ENDPOINT");
    const apiKey = Deno.env.get("BOT_API_KEY");
    let videoUrl = bot.recording_url;
    if (endpoint && apiKey) {
      try {
        const response = await fetch(`${endpoint}/api/bots/${botId}/recording`, { headers: { "Content-Type": "application/json", "x-api-key": apiKey } });
        if (response.ok) { const data = await response.json(); if (data.recordingUrl) videoUrl = data.recordingUrl; }
      } catch { /* fallback */ }
    }

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error("Failed to download recording");
    const videoBuffer = await videoResponse.arrayBuffer();

    const accessToken = await refreshAccessToken();
    if (!accessToken) throw new Error("YouTube not authenticated");

    const metadata = {
      snippet: { title: bot.meeting_title ?? "Meeting Recording", description: `Recorded on ${new Date(bot.created_at).toLocaleString()}`, categoryId: "22" },
      status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
    };

    const boundary = "-------" + Math.random().toString(36).slice(2);
    const parts: Uint8Array[] = [];
    const enc = new TextEncoder();
    parts.push(enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`));
    parts.push(new Uint8Array(videoBuffer));
    parts.push(enc.encode(`\r\n--${boundary}--\r\n`));
    const totalLength = parts.reduce((s, p) => s + p.length, 0);
    const body = new Uint8Array(totalLength);
    let off = 0;
    for (const p of parts) { body.set(p, off); off += p.length; }

    const uploadResponse = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}`, "Content-Length": String(totalLength) },
      body,
    });
    if (!uploadResponse.ok) throw new Error(`YouTube upload failed: ${await uploadResponse.text()}`);
    const uploadData = await uploadResponse.json();

    await supabase.from("bots").update({ youtube_video_id: uploadData.id, youtube_upload_status: "done" }).eq("id", botId);
    return new Response(JSON.stringify({ success: true, videoId: uploadData.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    if (botId) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("bots").update({ youtube_upload_status: "failed" }).eq("id", botId).catch(() => {});
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
