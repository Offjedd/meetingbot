import { useState, useEffect } from "react";
import { useAuth } from "~/lib/auth-context";
import { supabase } from "~/lib/supabase";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { toast } from "sonner";
import { Youtube, Check, ExternalLink, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "~/lib/api";

export default function YouTubePage() {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/youtube/status?userId=${user?.id}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setConnected(data?.connected ?? false);
    } catch {
      setConnected(false);
    }
    setLoading(false);
  };

  const connectYouTube = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error("Google OAuth not configured");
      return;
    }
    const redirectUri = `${window.location.origin}/youtube-setup`;
    const scope = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    window.location.href = url;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">YouTube Integration</h1>
        <p className="text-muted-foreground">Upload meeting recordings to YouTube</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Youtube className="size-5 text-red-600" />
            Connection Status
          </CardTitle>
          <CardDescription>
            Connect your YouTube account to automatically upload recordings as private videos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {connected ? (
              <Badge className="bg-green-100 text-green-800">
                <Check className="size-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>

          {!connected && (
            <Button onClick={connectYouTube} className="w-full">
              <ExternalLink className="size-4" /> Connect YouTube Account
            </Button>
          )}

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground space-y-1">
            <p>Recordings will be uploaded as <strong>private</strong> videos.</p>
            <p>You can change visibility later in YouTube Studio.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
