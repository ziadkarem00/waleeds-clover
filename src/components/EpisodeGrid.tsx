"use client";

import React from "react";
import { Check, Heart, RotateCcw } from "lucide-react";
import type { Episode } from "@/types/anime";

interface EpisodeGridProps {
  episodes: Episode[];
  activeEpisodeNumber: number;
  watchedSet: Set<number>;
  favoriteSet: Set<number>;
  isLoading: boolean;
  onSelectEpisode: (episodeNumber: number) => void;
  onToggleWatched: (episodeNumber: number) => void;
  onToggleFavorite: (episodeNumber: number) => void;
  onResetFilters: () => void;
}

export function EpisodeGrid({
  episodes,
  activeEpisodeNumber,
  watchedSet,
  favoriteSet,
  isLoading,
  onSelectEpisode,
  onToggleWatched,
  onToggleFavorite,
  onResetFilters,
}: EpisodeGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, idx) => (
          <div
            key={idx}
            className="flex h-36 flex-col justify-between rounded-xl border border-hairline bg-surface p-4"
          >
            <div className="h-4 w-14 animate-pulse rounded bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-800" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-zinc-800/60" />
            </div>
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-800/60" />
          </div>
        ))}
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-hairline bg-surface px-6 py-14 text-center">
        <p className="text-sm font-medium text-zinc-200">
          No episodes match your current filter.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-obsidian px-3.5 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {episodes.map((ep) => {
        const isActive = ep.number === activeEpisodeNumber;
        const isWatched = watchedSet.has(ep.number);
        const isFavorite = favoriteSet.has(ep.number);

        return (
          <article
            key={ep.number}
            onClick={() => onSelectEpisode(ep.number)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectEpisode(ep.number);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Play Episode ${ep.number}: ${ep.title}`}
            className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-4 transition-colors focus:outline-none focus:ring-1 focus:ring-crimson ${
              isActive
                ? "border-crimson bg-surface-hover"
                : "border-hairline bg-surface hover:border-zinc-700 hover:bg-surface-hover"
            }`}
          >
            {/* Active Left Crimson Indicator Bar */}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-[3px] bg-crimson"
              />
            )}

            {/* Top Row: Episode Number + Playing / Filler Label */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-xs font-semibold ${
                    isActive
                      ? "text-crimson"
                      : isWatched
                      ? "text-zinc-500"
                      : "text-zinc-300"
                  }`}
                >
                  EP {String(ep.number).padStart(3, "0")}
                </span>
                {isActive && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-crimson">
                    Playing
                  </span>
                )}
              </div>

              {ep.filler && (
                <span className="rounded border border-hairline bg-obsidian px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Filler
                </span>
              )}
            </div>

            {/* Middle Row: Title & Romaji */}
            <div className="my-3 min-h-[2.75rem]">
              <h4
                className={`line-clamp-2 text-sm font-medium leading-snug ${
                  isWatched && !isActive
                    ? "text-zinc-400 group-hover:text-zinc-200"
                    : "text-zinc-100 group-hover:text-white"
                }`}
              >
                {ep.title}
              </h4>
              {ep.titleRomaji && ep.titleRomaji !== ep.title && (
                <p className="mt-0.5 line-clamp-1 text-xs text-zinc-600">
                  {ep.titleRomaji}
                </p>
              )}
            </div>

            {/* Bottom Row: Arc Name + Quiet Watched / Favorite Actions */}
            <div className="flex items-center justify-between gap-2 border-t border-hairline/70 pt-2.5">
              <span className="truncate text-[11px] text-zinc-500">
                {ep.arcName}
              </span>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  title={isWatched ? "Mark as Unwatched" : "Mark as Watched"}
                  aria-label={
                    isWatched
                      ? `Unmark Episode ${ep.number} as watched`
                      : `Mark Episode ${ep.number} as watched`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWatched(ep.number);
                  }}
                  className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                    isWatched
                      ? "bg-zinc-800 text-zinc-200"
                      : "text-zinc-600 hover:bg-zinc-800/70 hover:text-zinc-300"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                  aria-label={
                    isFavorite
                      ? `Remove Episode ${ep.number} from favorites`
                      : `Add Episode ${ep.number} to favorites`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(ep.number);
                  }}
                  className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                    isFavorite
                      ? "text-crimson"
                      : "text-zinc-600 hover:bg-zinc-800/70 hover:text-zinc-300"
                  }`}
                >
                  <Heart
                    className={`h-3.5 w-3.5 ${isFavorite ? "fill-crimson" : ""}`}
                  />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
