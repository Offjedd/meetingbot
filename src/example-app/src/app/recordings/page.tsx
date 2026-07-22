"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "~/lib/supabase/client";
import type { Bot } from "~/lib/types";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Globe, Video, Users, Play, Download, Youtube, FileText } from "lucide-react";
import { format } from "date-fns";

const platformIcons: Record<string, typeof Globe> = { google: Globe, zoom: Video, teams: Users };
const youtubeStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "outline" },
  uploading: { label: "Uploading", variant: "secondary" },
  done: { label: "Uploaded", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function RecordingsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const supabase = createClient();

  const fetchBots = useCallback(async () => {
    const { data } = await supabase
      .from("bots")
      .select("*")
      .eq("status", "DONE")
      .not("recording_url", "is", null)
      .order("created_at", { ascending: false });
    if (data) setBots(data as Bot[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const fetchRecordingUrl = useCallback(async (bot: Bot) => {
    if (!bot.recording_url) return;
    setFetchingUrl(true);
    try {
      const endpoint = process.env.NEXT_PUBLIC_MEETINGBOT_ENDPOINT;
      const apiKey = process.env.NEXT_PUBLIC_BOT_API_KEY;
      if (endpoint && apiKey) {
        const response = await fetch(`${endpoint}/api/bots/${bot.id}/recording`, { headers: { "Content-Type": "application/json", "x-api-key": apiKey } });
        if (response.ok) {
          const data = await response.json();
          if (data.recordingUrl) { setRecordingUrl(data.recordingUrl); return; }
        }
      }
      setRecordingUrl(bot.recording_url);
    } catch { setRecordingUrl(bot.recording_url); }
    finally { setFetchingUrl(false); }
  }, []);

  const handleOpenRecording = (bot: Bot) => {
    setSelectedBot(bot);
    setRecordingUrl(null);
    fetchRecordingUrl(bot);
  };

  const handleReupload = async (bot: Bot) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/youtube-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ botId: bot.id }),
      });
    } catch { /* silent */ }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Video className="size-6 animate-pulse text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Recordings</h1>
        <p className="text-sm text-muted-foreground">View and download past meeting recordings</p>
      </div>
      {bots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No recordings available yet. Completed recordings will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meeting</TableHead><TableHead>Platform</TableHead><TableHead>Date</TableHead><TableHead>YouTube</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bots.map((bot) => {
                  const PlatformIcon = bot.platform ? platformIcons[bot.platform] ?? Globe : Globe;
                  const ytStatus = bot.youtube_upload_status ? youtubeStatusConfig[bot.youtube_upload_status] ?? { label: bot.youtube_upload_status, variant: "outline" as const } : null;
                  return (
                    <TableRow key={bot.id}>
                      <TableCell className="font-medium">{bot.meeting_title ?? "Untitled"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PlatformIcon className="size-4 text-muted-foreground" />
                          <span className="text-sm capitalize">{bot.platform ?? "unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(bot.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>{ytStatus ? <Badge variant={ytStatus.variant}>{ytStatus.label}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleOpenRecording(bot)}>
                          <Play className="size-4" /> Play
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Dialog open={!!selectedBot} onOpenChange={(open) => { if (!open) { setSelectedBot(null); setRecordingUrl(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedBot?.meeting_title ?? "Recording"}</DialogTitle></DialogHeader>
          {fetchingUrl ? (
            <div className="flex h-48 items-center justify-center"><Video className="size-6 animate-pulse text-muted-foreground" /></div>
          ) : recordingUrl ? (
            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-lg bg-black">
                <video src={recordingUrl} controls className="w-full" style={{ maxHeight: "400px" }} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><a href={recordingUrl} download><Download className="size-4" /> Download</a></Button>
                {selectedBot?.youtube_video_id && (
                  <Button asChild size="sm" variant="outline"><a href={`https://www.youtube.com/watch?v=${selectedBot.youtube_video_id}`} target="_blank" rel="noopener noreferrer"><Youtube className="size-4" /> View on YouTube</a></Button>
                )}
                {selectedBot && (!selectedBot.youtube_upload_status || selectedBot.youtube_upload_status === "failed") && (
                  <Button size="sm" variant="outline" onClick={() => handleReupload(selectedBot)}><Youtube className="size-4" /> Upload to YouTube</Button>
                )}
                <Button asChild size="sm" variant="outline"><a href={`/transcripts?botId=${selectedBot?.id}`}><FileText className="size-4" /> View Transcript</a></Button>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Could not load recording</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
