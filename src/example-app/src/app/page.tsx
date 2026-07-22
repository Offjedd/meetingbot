"use client";

import { useState, useMemo } from "react";
import { createClient } from "~/lib/supabase/client";
import { detectPlatform, defineMeetingInfo } from "~/lib/meeting-parser";
import type { MeetingPlatform } from "~/lib/types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { Video, CalendarIcon, Clock, Zap, Users, Globe } from "lucide-react";
import { cn } from "~/lib/utils";

const platformMeta: Record<MeetingPlatform, { label: string; icon: typeof Globe; color: string }> = {
  google: { label: "Google Meet", icon: Globe, color: "text-blue-600" },
  zoom: { label: "Zoom", icon: Video, color: "text-blue-500" },
  teams: { label: "MS Teams", icon: Users, color: "text-purple-600" },
};

export default function NewMeetingPage() {
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("21:00");
  const [delayHours, setDelayHours] = useState(1);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const platform = useMemo(() => detectPlatform(link), [link]);
  const platformInfo = platform ? platformMeta[platform] : null;

  const getScheduledAt = (): string | null => {
    if (mode === "immediate") return null;
    if (scheduledDate) {
      const [h, m] = scheduledTime.split(":").map(Number);
      const date = new Date(scheduledDate);
      date.setHours(h ?? 21, m ?? 0, 0, 0);
      return date.toISOString();
    }
    const future = new Date();
    future.setHours(future.getHours() + delayHours);
    return future.toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform) {
      toast.error("Invalid meeting link. Must be Google Meet, Zoom, or Teams");
      return;
    }
    const meetingInfo = defineMeetingInfo(link, platform);
    if (!meetingInfo) {
      toast.error("Could not parse meeting info from link");
      return;
    }
    setLoading(true);
    try {
      const meetingTitle = title.trim() || `${platformInfo?.label ?? "Meeting"} - ${new Date().toLocaleDateString()}`;
      const scheduledAt = getScheduledAt();

      const { data, error } = await supabase
        .from("bots")
        .insert({
          meeting_url: link,
          platform,
          meeting_title: meetingTitle,
          meeting_info: meetingInfo as unknown as Record<string, unknown>,
          status: "READY_TO_DEPLOY",
          scheduled_at: scheduledAt,
        })
        .select()
        .single();

      if (error) throw error;

      if (!scheduledAt) {
        const endpoint = process.env.NEXT_PUBLIC_MEETINGBOT_ENDPOINT;
        const apiKey = process.env.NEXT_PUBLIC_BOT_API_KEY;
        if (endpoint && apiKey) {
          const callbackUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bot-callback`;
          const response = await fetch(`${endpoint}/api/bots`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({ userId: data.user_id, meetingTitle, meetingInfo, callbackUrl }),
          });
          if (!response.ok) throw new Error("Failed to deploy bot");
        }
        await supabase.from("bots").update({ status: "DEPLOYING", started_at: new Date().toISOString() }).eq("id", data.id);
        toast.success("Bot deployed! It will join the meeting shortly.");
      } else {
        toast.success(`Bot scheduled for ${new Date(scheduledAt).toLocaleString()}`);
      }

      setLink("");
      setTitle("");
      setScheduledDate(undefined);
      setScheduledTime("21:00");
      setDelayHours(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create bot");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">New Meeting</h1>
        <p className="text-sm text-muted-foreground">Submit a meeting link to deploy a recording bot</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Meeting Details</CardTitle>
          <CardDescription>Paste your meeting link below. The platform will be detected automatically.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="link">Meeting Link</Label>
              <Input id="link" type="text" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" className="h-11" required />
              {platformInfo && (
                <div className="flex items-center gap-2">
                  <platformInfo.icon className={cn("size-4", platformInfo.color)} />
                  <Badge variant="secondary">{platformInfo.label}</Badge>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Meeting Title (optional)</Label>
              <Input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly Team Standup" />
            </div>
            <div className="flex flex-col gap-3">
              <Label>When should the bot start?</Label>
              <div className="flex gap-2">
                <Button type="button" variant={mode === "immediate" ? "default" : "outline"} size="sm" onClick={() => setMode("immediate")}>
                  <Zap className="size-4" /> Start Immediately
                </Button>
                <Button type="button" variant={mode === "scheduled" ? "default" : "outline"} size="sm" onClick={() => setMode("scheduled")}>
                  <Clock className="size-4" /> Schedule
                </Button>
              </div>
            </div>
            {mode === "scheduled" && (
              <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-col gap-2">
                  <Label>Pick a date and time</Label>
                  <div className="flex flex-wrap gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start">
                          <CalendarIcon className="size-4" />
                          {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} />
                      </PopoverContent>
                    </Popover>
                    <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="w-32" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">OR</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Quick delay (hours from now)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={168} value={delayHours} onChange={(e) => setDelayHours(Number(e.target.value) || 1)} className="w-24" />
                    <span className="text-sm text-muted-foreground">hour(s) from now</span>
                  </div>
                </div>
              </div>
            )}
            <Button type="submit" size="lg" disabled={loading || !platform}>
              {loading ? "Creating..." : mode === "immediate" ? "Deploy Bot Now" : "Schedule Bot"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
