"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "~/lib/supabase/client";
import type { Bot, BotEvent } from "~/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Globe, Video, Users, Bot as BotIcon, Clock, Activity, Zap } from "lucide-react";
import { cn } from "~/lib/utils";

const statusConfig: Record<string, { color: string; label: string }> = {
  READY_TO_DEPLOY: { color: "bg-gray-500", label: "Ready" },
  DEPLOYING: { color: "bg-blue-500", label: "Deploying" },
  JOINING_CALL: { color: "bg-blue-500", label: "Joining" },
  IN_WAITING_ROOM: { color: "bg-yellow-500", label: "Waiting Room" },
  IN_CALL: { color: "bg-green-500", label: "In Call" },
  CALL_ENDED: { color: "bg-gray-500", label: "Call Ended" },
  DONE: { color: "bg-gray-400", label: "Done" },
  FATAL: { color: "bg-red-500", label: "Error" },
};

const platformIcons: Record<string, typeof Globe> = {
  google: Globe,
  zoom: Video,
  teams: Users,
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function ActiveBotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [events, setEvents] = useState<Record<string, BotEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchBots = useCallback(async () => {
    const { data } = await supabase
      .from("bots")
      .select("*")
      .not("status", "in", '("DONE","FATAL")')
      .order("created_at", { ascending: false });
    if (data) setBots(data as Bot[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchBots();
    const channel = supabase
      .channel("bots-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bots" },
        () => fetchBots(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBots, supabase]);

  const fetchEvents = useCallback(
    async (botId: string) => {
      const { data } = await supabase
        .from("bot_events")
        .select("*")
        .eq("bot_id", botId)
        .order("event_time", { ascending: false })
        .limit(50);
      if (data) setEvents((prev) => ({ ...prev, [botId]: data as BotEvent[] }));
    },
    [supabase],
  );

  const handleDeployNow = async (bot: Bot) => {
    const endpoint = process.env.NEXT_PUBLIC_MEETINGBOT_ENDPOINT;
    const apiKey = process.env.NEXT_PUBLIC_BOT_API_KEY;
    if (!endpoint || !apiKey) {
      return;
    }
    try {
      const callbackUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bot-callback`;
      const response = await fetch(`${endpoint}/api/bots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          userId: bot.user_id,
          meetingTitle: bot.meeting_title,
          meetingInfo: bot.meeting_info,
          callbackUrl,
        }),
      });
      if (!response.ok) throw new Error("Failed to deploy");
      await supabase
        .from("bots")
        .update({ status: "DEPLOYING", started_at: new Date().toISOString() })
        .eq("id", bot.id);
    } catch {
      // error handled silently
    }
  };

  const stats = {
    total: bots.length,
    inCall: bots.filter((b) => b.status === "IN_CALL").length,
    waiting: bots.filter((b) => b.status === "IN_WAITING_ROOM").length,
    errors: bots.filter((b) => b.status === "FATAL").length,
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Activity className="size-6 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Active Bots</h1>
        <p className="text-sm text-muted-foreground">
          Monitor bots currently in meetings
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <BotIcon className="size-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="size-2.5 rounded-full bg-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.inCall}</p>
              <p className="text-xs text-muted-foreground">In Call</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="size-2.5 rounded-full bg-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats.waiting}</p>
              <p className="text-xs text-muted-foreground">Waiting</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="size-2.5 rounded-full bg-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats.errors}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {bots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BotIcon className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No active bots. Deploy one from the New Meeting page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {bots.map((bot) => {
            const PlatformIcon = bot.platform
              ? platformIcons[bot.platform] ?? Globe
              : Globe;
            const status = statusConfig[bot.status] ?? {
              color: "bg-gray-400",
              label: bot.status,
            };
            const heartbeatStale =
              bot.last_heartbeat &&
              Date.now() - new Date(bot.last_heartbeat).getTime() > 30000;

            return (
              <Card key={bot.id} className="py-4">
                <CardContent className="flex items-center justify-between gap-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <PlatformIcon className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {bot.meeting_title ?? "Untitled Meeting"}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div
                            className={cn(
                              "size-2 rounded-full",
                              status.color,
                            )}
                          />
                          <span className="text-xs text-muted-foreground">
                            {status.label}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">·</span>
                        <div className="flex items-center gap-1">
                          <Clock className="size-3 text-muted-foreground" />
                          <span
                            className={cn(
                              "text-xs",
                              heartbeatStale && "text-red-500",
                            )}
                          >
                            {timeAgo(bot.last_heartbeat)}
                          </span>
                        </div>
                        {bot.scheduled_at && bot.status === "READY_TO_DEPLOY" && (
                          <>
                            <span className="text-xs text-muted-foreground">
                              ·
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Scheduled:{" "}
                              {new Date(bot.scheduled_at).toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {bot.status === "READY_TO_DEPLOY" && bot.scheduled_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeployNow(bot)}
                      >
                        <Zap className="size-4" />
                        Deploy Now
                      </Button>
                    )}
                    <Dialog
                      onOpenChange={(open) => {
                        if (open) fetchEvents(bot.id);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost">
                          Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>
                            {bot.meeting_title ?? "Bot Events"}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="max-h-[400px] overflow-y-auto">
                          {(events[bot.id] ?? []).length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                              No events recorded yet
                            </p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {(events[bot.id] ?? []).map((event) => (
                                <div
                                  key={event.id}
                                  className="flex items-start gap-3 rounded-lg border p-3"
                                >
                                  <div
                                    className={cn(
                                      "mt-1 size-2 rounded-full",
                                      (statusConfig[event.event_type] ?? {})
                                        .color ?? "bg-gray-400",
                                    )}
                                  />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">
                                      {event.event_type}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(event.event_time).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
