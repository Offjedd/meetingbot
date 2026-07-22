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
    const { botId } = await req.json();
    if (!botId) {
      return new Response(
        JSON.stringify({ error: "botId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .single();

    if (botError || !bot) throw new Error("Bot not found");
    if (!bot.recording_url) throw new Error("No recording URL available");

    const endpoint = Deno.env.get("MEETINGBOT_ENDPOINT");
    const apiKey = Deno.env.get("BOT_API_KEY");
    let audioUrl = bot.recording_url;

    if (endpoint && apiKey) {
      try {
        const response = await fetch(
          `${endpoint}/api/bots/${botId}/recording`,
          {
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
          },
        );
        if (response.ok) {
          const data = await response.json();
          if (data.recordingUrl) audioUrl = data.recordingUrl;
        }
      } catch {
        // Fall back to stored URL
      }
    }

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error("Failed to download recording");
    const audioBuffer = await audioResponse.arrayBuffer();

    const maxSize = 25 * 1024 * 1024;
    if (audioBuffer.byteLength > maxSize) {
      throw new Error("File too large for transcription (max 25MB)");
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OpenAI API key not configured");

    const audioBlob = new Blob([audioBuffer]);

    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: (() => {
          const formData = new FormData();
          formData.append("file", new File([audioBlob], "recording.mp4"));
          formData.append("model", "whisper-1");
          return formData;
        })(),
      },
    );

    if (!whisperResponse.ok) throw new Error("Transcription failed");
    const whisperData = await whisperResponse.json();
    const transcription = whisperData.text as string;

    const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
    let summary: string | null = null;

    if (deepseekKey) {
      try {
        const deepseekResponse = await fetch(
          "https://api.deepseek.com/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${deepseekKey}`,
            },
            body: JSON.stringify({
              model: "deepseek-v4-pro",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful assistant that summarizes meeting transcripts. Provide a concise summary.",
                },
                {
                  role: "user",
                  content: `Please provide a concise summary of this meeting transcript: ${transcription}`,
                },
              ],
              stream: false,
            }),
          },
        );

        if (deepseekResponse.ok) {
          const deepseekData = await deepseekResponse.json();
          summary = deepseekData.choices?.[0]?.message?.content ?? null;
        }
      } catch {
        // Summary is optional
      }
    }

    const { error: insertError } = await supabase
      .from("transcripts")
      .insert({
        bot_id: botId,
        content: transcription,
        summary,
      });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
