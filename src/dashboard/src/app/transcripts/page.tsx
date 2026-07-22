"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "~/lib/supabase/client";
import type { Transcript, Bot } from "~/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { FileText, Search, ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "~/lib/utils";

interface TranscriptWithBot extends Transcript {
  bots: Pick<Bot, "meeting_title" | "platform" | "created_at"> | null;
}

function HighlightedText({
  text,
  search,
  matchRefs,
  currentMatch,
}: {
  text: string;
  search: string;
  matchRefs: React.RefObject<(HTMLSpanElement | null)[]>;
  currentMatch: number;
}) {
  if (!search.trim()) return <>{text}</>;
  const parts: { text: string; isMatch: boolean }[] = [];
  const lowerText = text.toLowerCase();
  const lowerSearch = search.toLowerCase();
  let lastIndex = 0;
  let matchIndex = lowerText.indexOf(lowerSearch, lastIndex);
  let matchCount = 0;
  while (matchIndex !== -1) {
    if (matchIndex > lastIndex) {
      parts.push({ text: text.slice(lastIndex, matchIndex), isMatch: false });
    }
    parts.push({
      text: text.slice(matchIndex, matchIndex + search.length),
      isMatch: true,
    });
    lastIndex = matchIndex + search.length;
    matchIndex = lowerText.indexOf(lowerSearch, lastIndex);
    matchCount++;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMatch: false });
  }

  let mIdx = 0;
  return (
    <>
      {parts.map((part, i) => {
        if (part.isMatch) {
          const matchNum = mIdx++;
          return (
            <span
              key={i}
              ref={(el) => {
                if (matchRefs.current) {
                  matchRefs.current[matchNum] = el;
                }
              }}
              className={cn(
                "rounded px-0.5",
                matchNum === currentMatch
                  ? "bg-yellow-300 text-black"
                  : "bg-yellow-200/60",
              )}
            >
              {part.text}
            </span>
          );
        }
        return <span key={i}>{part.text}</span>;
      })}
    </>
  );
}

export default function TranscriptsPage() {
  return (
    <Suspense fallback={null}>
      <TranscriptsContent />
    </Suspense>
  );
}

function TranscriptsContent() {
  const [transcripts, setTranscripts] = useState<TranscriptWithBot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentMatch, setCurrentMatch] = useState(0);
  const searchParams = useSearchParams();
  const matchRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const supabase = createClient();

  const fetchTranscripts = useCallback(async () => {
    const { data } = await supabase
      .from("transcripts")
      .select("*, bots:bot_id(meeting_title, platform, created_at)")
      .order("created_at", { ascending: false });
    if (data) {
      setTranscripts(data as TranscriptWithBot[]);
      const botIdParam = searchParams.get("botId");
      if (botIdParam) {
        const found = (data as TranscriptWithBot[]).find(
          (t) => t.bot_id === botIdParam,
        );
        if (found) setSelectedId(found.id);
      }
    }
    setLoading(false);
  }, [supabase, searchParams]);

  useEffect(() => {
    fetchTranscripts();
  }, [fetchTranscripts]);

  const selected = transcripts.find((t) => t.id === selectedId);

  const matchCount = useMemo(() => {
    if (!search.trim() || !selected) return 0;
    const lowerText = selected.content.toLowerCase();
    const lowerSearch = search.toLowerCase();
    let count = 0;
    let idx = lowerText.indexOf(lowerSearch);
    while (idx !== -1) {
      count++;
      idx = lowerText.indexOf(lowerSearch, idx + search.length);
    }
    return count;
  }, [search, selected]);

  useEffect(() => {
    setCurrentMatch(0);
    matchRefs.current = new Array(matchCount).fill(null);
  }, [search, matchCount]);

  useEffect(() => {
    if (matchRefs.current[currentMatch]) {
      matchRefs.current[currentMatch]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentMatch]);

  const handlePrevMatch = () => {
    setCurrentMatch((prev) =>
      prev === 0 ? Math.max(matchCount - 1, 0) : prev - 1,
    );
  };

  const handleNextMatch = () => {
    setCurrentMatch((prev) =>
      prev >= matchCount - 1 ? 0 : prev + 1,
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <FileText className="size-6 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Transcripts</h1>
        <p className="text-sm text-muted-foreground">
          Search and review meeting transcripts
        </p>
      </div>

      {transcripts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No transcripts available. Generate one from the Recordings page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-6">
          <div className="w-64 shrink-0">
            <Card className="p-2">
              <CardContent className="flex flex-col gap-1 p-0">
                {transcripts.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      "rounded-md p-3 text-left transition-colors",
                      selectedId === t.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50",
                    )}
                  >
                    <p className="text-sm font-medium">
                      {t.bots?.meeting_title ?? "Untitled"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(t.created_at), "MMM d, yyyy")}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex-1">
            {selected ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {selected.bots?.meeting_title ?? "Untitled"}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(
                          new Date(selected.created_at),
                          "EEEE, MMM d, yyyy 'at' h:mm a",
                        )}
                      </p>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {selected.bots?.platform ?? "unknown"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {selected.summary && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" />
                        <span className="text-sm font-medium">AI Summary</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selected.summary}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search transcript..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {search.trim() && matchCount > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                          {currentMatch + 1}/{matchCount}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={handlePrevMatch}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={handleNextMatch}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="max-h-[500px] overflow-y-auto rounded-lg border p-4">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      <HighlightedText
                        text={selected.content}
                        search={search}
                        matchRefs={matchRefs}
                        currentMatch={currentMatch}
                      />
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex h-64 items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    Select a transcript to view
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
