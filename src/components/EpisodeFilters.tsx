"use client";

import React from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { STORY_ARCS } from "@/lib/arcs";
import type { StoryArcId } from "@/types/anime";

interface EpisodeFiltersProps {
  selectedArc: StoryArcId;
  onSelectArc: (arcId: StoryArcId) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  hideFiller: boolean;
  onToggleHideFiller: () => void;
  favoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  totalMatching: number;
  favoritesCount: number;
  showSyncButton: boolean;
  isRefreshing: boolean;
  onRefreshMetadata: () => void;
}

export function EpisodeFilters({
  selectedArc,
  onSelectArc,
  searchQuery,
  onSearchChange,
  hideFiller,
  onToggleHideFiller,
  favoritesOnly,
  onToggleFavoritesOnly,
  totalMatching,
  favoritesCount,
  showSyncButton,
  isRefreshing,
  onRefreshMetadata,
}: EpisodeFiltersProps) {
  return (
    <section className="space-y-4">
      {/* Story Arc Horizontal Tabs */}
      <div className="border-b border-hairline">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {STORY_ARCS.map((arc) => {
            const isSelected = arc.id === selectedArc;
            return (
              <button
                key={arc.id}
                type="button"
                onClick={() => onSelectArc(arc.id)}
                className={`relative shrink-0 whitespace-nowrap px-3.5 py-3 text-xs font-medium transition-colors ${
                  isSelected
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span>{arc.shortName}</span>
                <span className="ml-1.5 font-mono text-[11px] text-zinc-600">
                  {arc.rangeLabel}
                </span>
                {isSelected && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-crimson" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search episode number or title..."
            aria-label="Search episodes by number or title"
            className="w-full rounded-lg border border-hairline bg-surface py-2 pl-9 pr-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleHideFiller}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              hideFiller
                ? "border-zinc-600 bg-zinc-800 text-white"
                : "border-hairline bg-surface text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            Hide Filler {hideFiller ? "· On" : ""}
          </button>

          <button
            type="button"
            onClick={onToggleFavoritesOnly}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              favoritesOnly
                ? "border-crimson/60 bg-crimson/10 text-zinc-100"
                : "border-hairline bg-surface text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            Favorites ({favoritesCount})
          </button>

          {showSyncButton && (
            <button
              type="button"
              onClick={onRefreshMetadata}
              disabled={isRefreshing}
              title="Retry syncing episode titles from Jikan"
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>Sync Titles</span>
            </button>
          )}

          <span className="ml-1 font-mono text-xs text-zinc-500">
            {totalMatching} {totalMatching === 1 ? "ep" : "eps"}
          </span>
        </div>
      </div>
    </section>
  );
}
