import { useEffect, useState, useCallback } from "react";
import { useAuth } from "~/lib/auth-context";
import { supabase } from "~/lib/supabase";
import { Bot, BotEvent } from "~/lib/types";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "~/components/ui/dialog";
import { toast } from "sonner";
import { Activity, Clock, CircleAlert as AlertCircle, Phone, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const statusColors: Record<string, string> = {
  DEPLOYING: "bg-blue-100 text-blue-800",
  READY_TO_DEPLOY: "bg-amber-100 text-amber-800",
  JOINING: "bg-cyan-100 text-cyan-800",
  IN_CALL: "bg-green-100 text-green-800",
  RECORDING: "bg-green-100 text-green-800",
  ERROR: "bg-red-100 text-red-800",
};

export default function ActivePage() {
  const { user } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [events, setEvents] = useState<BotEvent[]>([]);

  const fetchBots = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bots")
      .select("*")
      .eq("user_id", user.id)
      .not("status", "in", '("DONE","FATAL")')
      .order("created_at", { ascending: false });
    if (data) setBots(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchBots();
    const channel = supabase
      .channel("bots-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bots" }, () => {
        fetchBots();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBots]);

  const loadEvents = async (bot: Bot) => {
    setSelectedBot(bot);
    const { data } = await supabase
      .from("bot_events")
      .select("*")
      .eq("bot_id", bot.id)
      .order("event_time", { ascending: false });
    if (data) setEvents(data);
  };

  const deployNow = async (bot: Bot) => {
    const { error } = await supabase
      .from("bots")
      .update({ status: "DEPLOYING", scheduled_at: null })
      .eq("id", bot.id);
    if (error) {
      toast.error("Failed to deploy");
      return;
    }
    try {
      const { error: deployError } = await supabase.functions.invoke("deploy-bot", {
        body: { botId: bot.id },
      });
      if (deployError) throw deployError;
      toast.success("Deploying bot now");
    } catch {
      toast.error("Failed to trigger deployment on backend");
    }
  };

  const inCall = bots.filter((b) => ["IN_CALL", "RECORDING"].includes(b.status)).length;
  const waiting = bots.filter((b) => ["DEPLOYING", "JOINING", "READY_TO_DEPLOY"].includes(b.status)).length;
  const errors = bots.filter((b) => b.status === "ERROR").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Active Bots</h1>
        <p className="text-muted-foreground">Monitor your running meeting bots</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Active" value={bots.length} icon={<Activity className="size-4" />} />
        <StatCard label="In Call" value={inCall} icon={<Phone className="size-4 text-green-600" />} />
        <StatCard label="Waiting" value={waiting} icon={<Clock className="size-4 text-amber-600" />} />
        <StatCard label="Errors" value={errors} icon={<AlertCircle className="size-4 text-red-600" />} />
      </div>

      {bots.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No active bots. Deploy one from the New Meeting page.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <Card key={bot.id} className="gap-3 py-4">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{bot.meeting_title}</span>
                  <Badge className={statusColors[bot.status] || ""}>{bot.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Platform: {bot.platform}</div>
                  {bot.last_heartbeat && (
                    <div className={`${Date.now() - new Date(bot.last_heartbeat).getTime() > 30000 ? "text-red-500" : ""}`}>
                      Heartbeat: {formatDistanceToNow(new Date(bot.last_heartbeat), { addSuffix: true })}
                    </div>
                  )}
                  {bot.scheduled_at && <div>Scheduled: {new Date(bot.scheduled_at).toLocaleString()}</div>}
                </div>
                <div className="flex gap-2">
                  {bot.status === "READY_TO_DEPLOY" && (
                    <Button size="sm" onClick={() => deployNow(bot)}>Deploy Now</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => loadEvents(bot)}>Details</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedBot} onOpenChange={() => setSelectedBot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedBot?.meeting_title}</DialogTitle>
            <DialogDescription>Bot events log</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded yet.</p>
            ) : (
              events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-2 border-b pb-2 last:border-0">
                  <Badge variant="outline" className="text-[10px]">{ev.event_type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ev.event_time).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}
