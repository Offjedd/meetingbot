import { useState, useMemo } from "react";
import { useAuth } from "~/lib/auth-context";
import { supabase } from "~/lib/supabase";
import { API_BASE_URL } from "~/lib/api";
import { detectPlatform, defineMeetingInfo } from "~/lib/meeting-parser";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { toast } from "sonner";
import { Send, Calendar, Clock, Video } from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();
  const [meetingLink, setMeetingLink] = useState("");
  const [title, setTitle] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [loading, setLoading] = useState(false);

  const platform = useMemo(() => detectPlatform(meetingLink), [meetingLink]);

  const platformLabel: Record<string, string> = {
    google: "Google Meet",
    zoom: "Zoom",
    teams: "Microsoft Teams",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !platform) return;

    const meetingInfo = defineMeetingInfo(meetingLink, platform);
    if (!meetingInfo) {
      toast.error("Could not parse meeting link");
      return;
    }

    setLoading(true);

    let scheduledAt: string | null = null;
    if (scheduleMode === "scheduled" && scheduledDate && scheduledTime) {
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    }

    const { data: botData, error } = await supabase.from("bots").insert({
      meeting_url: meetingLink,
      platform,
      meeting_title: title || `${platformLabel[platform]} Meeting`,
      meeting_info: meetingInfo,
      status: scheduleMode === "immediate" ? "DEPLOYING" : "READY_TO_DEPLOY",
      scheduled_at: scheduledAt,
    }).select().single();

    if (error) {
      toast.error("Failed to create bot: " + error.message);
    } else if (scheduleMode === "immediate" && botData) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/bots/deploy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ botId: botData.id, meetingUrl: meetingLink, platform, meetingInfo }),
        });
        if (!res.ok) throw new Error(`Deploy failed (${res.status})`);
        toast.success("Bot is being deployed to your meeting!");
      } catch {
        toast.error("Bot created but failed to deploy. You can deploy from Active Bots.");
      }
      setMeetingLink("");
      setTitle("");
    } else {
      toast.success("Bot scheduled successfully!");
      setMeetingLink("");
      setTitle("");
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Meeting</h1>
        <p className="text-muted-foreground">Deploy a recording bot to your meeting</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="size-5" />
            Meeting Details
          </CardTitle>
          <CardDescription>Paste your meeting link to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link">Meeting Link</Label>
              <Input
                id="link"
                placeholder="https://meet.google.com/abc-defg-hij"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                required
              />
              {platform && (
                <Badge variant="secondary">{platformLabel[platform]}</Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="Team standup"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>When to deploy</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={scheduleMode === "immediate" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScheduleMode("immediate")}
                >
                  <Send className="size-4" /> Now
                </Button>
                <Button
                  type="button"
                  variant={scheduleMode === "scheduled" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScheduleMode("scheduled")}
                >
                  <Calendar className="size-4" /> Schedule
                </Button>
              </div>
            </div>

            {scheduleMode === "scheduled" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !platform}>
              {loading ? (
                <Clock className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {loading ? "Deploying..." : scheduleMode === "immediate" ? "Deploy Bot Now" : "Schedule Bot"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
