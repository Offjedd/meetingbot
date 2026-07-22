"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Route as Youtube, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Link2 } from "lucide-react";

export default function YouTubeSetupPage() {
  const [status, setStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/youtube-status`, {
          headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        });
        if (response.ok) {
          const data = await response.json();
          setStatus(data.connected ? "connected" : "disconnected");
        } else {
          setStatus("disconnected");
        }
      } catch {
        setStatus("disconnected");
      }
    };
    checkStatus();
  }, []);

  const handleConnect = () => {
    setLoading(true);
    const clientId = process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_YOUTUBE_REDIRECT_URI;
    if (!clientId || !redirectUri) { setLoading(false); return; }
    const scopes = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"].join(" ");
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    window.location.href = authUrl.toString();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">YouTube Integration</h1>
        <p className="text-sm text-muted-foreground">Connect your YouTube account for automatic private uploads</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/30">
              <Youtube className="size-6 text-red-600" />
            </div>
            <div>
              <CardTitle>YouTube Account</CardTitle>
              <CardDescription>Recordings are uploaded as private videos to your channel</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              {status === "connected" ? (
                <>
                  <CheckCircle2 className="size-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Connected</p>
                    <p className="text-xs text-muted-foreground">Videos will upload automatically when recordings finish</p>
                  </div>
                </>
              ) : status === "checking" ? (
                <>
                  <div className="size-5 animate-pulse rounded-full bg-muted" />
                  <p className="text-sm text-muted-foreground">Checking status...</p>
                </>
              ) : (
                <>
                  <AlertCircle className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Not connected</p>
                    <p className="text-xs text-muted-foreground">Connect to enable automatic YouTube uploads</p>
                  </div>
                </>
              )}
            </div>
            {status === "connected" && <Badge variant="default">Active</Badge>}
          </div>
          {status === "disconnected" && (
            <Button onClick={handleConnect} disabled={loading} size="lg">
              <Link2 className="size-4" />
              {loading ? "Redirecting..." : "Connect YouTube Account"}
            </Button>
          )}
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              When a recording finishes, the video is automatically uploaded to your YouTube channel as a <strong>private</strong> video. Only you can see it. Videos are never made public.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
