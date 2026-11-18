"use client";

import React from "react";
import { Play } from "lucide-react";
import { TOTAL_EPISODES } from "@/lib/arcs";
import { formatRelativeTimestamp } from "@/lib/storage";
import type { Episode, LastWatchedRecord } from "@/types/anime";

interface HeroBannerProps {
  watchedCount: number;
  lastWatched: LastWatchedRecord | null;
  resumeEpisodeData?: Episode;
  onResume: (episodeNumber: number) => void;
}

export function HeroBanner({
  watchedCount,
  lastWatched,
  resumeEpisodeData,
  onResume,
}: HeroBannerProps) {
  const progressPercent = Math.min(
    100,
    Math.round((watchedCount / TOTAL_EPISODES) * 100)
  );
  const resumeNumber = lastWatched?.episodeNumber ?? 1;

  return (
    <section className="rounded-xl border border-hairline bg-surface px-5 py-4 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500">
            <span className="font-medium uppercase tracking-wider text-zinc-400">
              {lastWatched ? "Continue Watching" : "Season 1 · Episodes 1–170"}
            </span>
            {lastWatched && (
              <>
                <span>·</span>
                <span>
                  {formatRelativeTimestamp(lastWatched.updatedAt)} (
                  {lastWatched.status === "completed" ? "Completed" : "In Progress"})
                </span>
              </>
            )}
          </div>

          <h2 className="mt-1 truncate text-base font-semibold text-zinc-100 sm:text-lg">
            Episode {resumeNumber}
            {resumeEpisodeData?.title &&
            resumeEpisodeData.title !== `Episode ${resumeNumber}`
              ? ` — ${resumeEpisodeData.title}`
              : ""}
          </h2>

          <div className="mt-3 flex items-center gap-3">
            <div className="h-[3px] flex-1 max-w-xs overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-crimson transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono text-xs text-zinc-400">
              {watchedCount} / {TOTAL_EPISODES} watched ({progressPercent}%)
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onResume(resumeNumber)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-crimson px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-crimson-hover"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>
            {lastWatched ? `Resume Episode ${resumeNumber}` : "Watch Episode 1"}
          </span>
        </button>
      </div>
    </section>
  );
}
