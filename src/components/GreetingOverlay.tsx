"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import { FiveLeafEmblem } from "@/components/FiveLeafLogo";
import { TOTAL_EPISODES } from "@/lib/arcs";
import type { LastWatchedRecord } from "@/types/anime";

interface GreetingOverlayProps {
  isOpen: boolean;
  onEnter: (resumeEpisode?: number) => void;
  watchedCount: number;
  lastWatched: LastWatchedRecord | null;
}

const QUOTES = [
  { text: "My magic is never giving up.", author: "Asta" },
  { text: "Surpass your limits. Right here, right now.", author: "Yami Sukehiro" },
  { text: "In the fifth leaf resides a devil.", author: "Grimoire Legend" },
];

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning, Waleed.";
  if (hour >= 12 && hour < 17) return "Good afternoon, Waleed.";
  if (hour >= 17 && hour < 22) return "Good evening, Waleed.";
  return "Late night session, Waleed.";
}

export function GreetingOverlay({
  isOpen,
  onEnter,
  watchedCount,
  lastWatched,
}: GreetingOverlayProps) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [greeting, setGreeting] = useState("Welcome back, Waleed.");
  const [quoteIdx, setQuoteIdx] = useState(0);

  const handleDismiss = useCallback(
    (episodeToPlay?: number) => {
      setIsLeaving(true);
      window.setTimeout(() => {
        setIsLeaving(false);
        onEnter(episodeToPlay);
      }, 220);
    },
    [onEnter]
  );

  useEffect(() => {
    setGreeting(getTimeGreeting());
    setQuoteIdx(Math.floor(Math.random() * QUOTES.length));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        handleDismiss(lastWatched?.episodeNumber);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, lastWatched, handleDismiss]);

  const quote = useMemo(() => QUOTES[quoteIdx] ?? QUOTES[0], [quoteIdx]);

  if (!isOpen) return null;

  const resumeEp = lastWatched?.episodeNumber ?? 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Waleed's Clover"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-obsidian px-6 transition-opacity duration-200 ${
        isLeaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="w-full max-w-md text-center">
        {/* Embossed Five-Leaf Emblem */}
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-hairline bg-surface">
          <FiveLeafEmblem className="h-11 w-11" />
        </div>

        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
          Waleed&apos;s Clover · Dedicated to Walid
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          {greeting}
        </h1>

        <p className="mt-3 text-sm text-zinc-400">
          &ldquo;{quote.text}&rdquo;{" "}
          <span className="text-zinc-600">— {quote.author}</span>
        </p>

        {/* Minimal Progress Line */}
        <div className="mx-auto mt-8 max-w-xs">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Season 1 Progress</span>
            <span className="font-mono text-zinc-300">
              {watchedCount} / {TOTAL_EPISODES}
            </span>
          </div>
          <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-crimson transition-all duration-300"
              style={{ width: `${Math.round((watchedCount / TOTAL_EPISODES) * 100)}%` }}
            />
          </div>
        </div>

        {/* Clean Actions */}
        <div className="mt-9 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => handleDismiss(resumeEp)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-crimson px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-crimson-hover"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>
              {lastWatched ? `Resume Episode ${resumeEp}` : "Start Episode 1"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleDismiss(undefined)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-hairline bg-surface px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
          >
            <span>Browse Episodes</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="mt-6 text-[11px] text-zinc-600">
          Press Enter to continue
        </p>
      </div>
    </div>
  );
}
