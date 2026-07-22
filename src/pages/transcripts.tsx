import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "~/lib/auth-context";
import { supabase } from "~/lib/supabase";
import { Transcript } from "~/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { RefreshCw, Search, FileText } from "lucide-react";

interface TranscriptWithMeta extends Transcript {
  bots?: { meeting_title: string; platform: string } | null;
}

export default function TranscriptsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [transcripts, setTranscripts] = useState<TranscriptWithMeta[]>([]);
  const [selected, setSelected] = useState<TranscriptWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchTranscripts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("transcripts")
      .select("*, bots(title, platform)")
      .order("created_at", { ascending: false });
    if (data) {
      setTranscripts(data);
      const botIdParam = searchParams.get("botId");
      if (botIdParam) {
        const match = data.find((t) => t.bot_id === botIdParam);
        if (match) setSelected(match);
      }
    }
    setLoading(false);
  }, [user, searchParams]);

  useEffect(() => {
    fetchTranscripts();
  }, [fetchTranscripts]);

  const highlightText = (text: string, term: string) => {
    if (!term) return text;
    const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === term.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
      ) : (
        part
      )
    );
  };

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
        <h1 className="text-2xl font-bold tracking-tight">Transcripts</h1>
        <p className="text-muted-foreground">Browse and search meeting transcripts</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {transcripts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No transcripts yet.</p>
          ) : (
            transcripts.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selected?.id === t.id ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm truncate">
                    {t.bots?.meeting_title || `Bot #${t.bot_id}`}
                  </span>
                </div>
                {t.bots?.platform && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">{t.bots.platform}</Badge>
                )}
              </button>
            ))
          )}
        </div>

        <Card>
          {selected ? (
            <>
              <CardHeader>
                <CardTitle className="text-lg">{selected.bots?.meeting_title || `Transcript #${selected.id}`}</CardTitle>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search in transcript..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected.summary && (
                  <>
                    <div>
                      <h3 className="text-sm font-medium mb-1">AI Summary</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{selected.summary}</p>
                    </div>
                    <Separator />
                  </>
                )}
                <div ref={contentRef} className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                  {highlightText(selected.content, searchTerm)}
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="py-10 text-center text-muted-foreground">
              Select a transcript to view its content.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
