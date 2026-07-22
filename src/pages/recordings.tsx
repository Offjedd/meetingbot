import { useEffect, useState, useCallback } from "react";
import { useAuth } from "~/lib/auth-context";
import { supabase } from "~/lib/supabase";
import { Bot } from "~/lib/types";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "~/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "~/components/ui/table";
import { toast } from "sonner";
import { Play, Download, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";


export default function RecordingsPage() {
  const { user } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchRecordings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bots")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "DONE")
      .not("recording_url", "is", null)
      .order("created_at", { ascending: false });
    if (data) setBots(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const playRecording = async (bot: Bot) => {
    setSelectedBot(bot);
    setVideoUrl(null);
    if (!bot.recording_url) return;
    if (bot.recording_url.startsWith("http")) {
      setVideoUrl(bot.recording_url);
      return;
    }
    try {
      const backendBotId = bot.backend_bot_id;
      if (!backendBotId) {
        setVideoUrl(bot.recording_url);
        return;
      }
      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-get-proxy?path=/api/bots/${backendBotId}/recording`;
      const res = await fetch(proxyUrl, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setVideoUrl(data.recordingUrl || bot.recording_url);
    } catch {
      setVideoUrl(bot.recording_url);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recordings</h1>
        <p className="text-muted-foreground">View and manage your meeting recordings</p>
      </div>

      {bots.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No recordings yet. Deploy a bot to start recording meetings.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meeting</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>YouTube</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bots.map((bot) => (
                <TableRow key={bot.id}>
                  <TableCell className="font-medium">{bot.meeting_title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{bot.platform}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(bot.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {bot.youtube_video_id ? (
                      <Badge className="bg-red-100 text-red-800">Uploaded</Badge>
                    ) : (
                      <Badge variant="outline">Not uploaded</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => playRecording(bot)}>
                        <Play className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/transcripts?botId=${bot.id}`)}
                      >
                        Transcript
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selectedBot} onOpenChange={() => setSelectedBot(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedBot?.meeting_title}</DialogTitle>
          </DialogHeader>
          {selectedBot?.recording_url && (
            <div className="space-y-3">
              {videoUrl === null ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <video
                  src={videoUrl || undefined}
                  controls
                  className="w-full rounded-lg bg-black"
                />
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={videoUrl || selectedBot.recording_url} download>
                    <Download className="size-4" /> Download
                  </a>
                </Button>
                {selectedBot.youtube_video_id && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`https://www.youtube.com/watch?v=${selectedBot.youtube_video_id}`} target="_blank" rel="noopener noreferrer">
                      YouTube
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
