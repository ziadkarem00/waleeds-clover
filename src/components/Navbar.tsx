"use client";

import React from "react";
import { Heart } from "lucide-react";
import { FiveLeafLogo } from "@/components/FiveLeafLogo";
import { TOTAL_EPISODES } from "@/lib/arcs";

interface NavbarProps {
  watchedCount: number;
  favoritesCount: number;
  favoritesOnly: boolean;
  onShowFavorites: () => void;
  onOpenGreeting: () => void;
  onScrollTop: () => void;
}

export function Navbar({
  watchedCount,
  favoritesCount,
  favoritesOnly,
  onShowFavorites,
  onOpenGreeting,
  onScrollTop,
}: NavbarProps) {
  const progressPercent = Math.round((watchedCount / TOTAL_EPISODES) * 100);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-obsidian/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <FiveLeafLogo onClick={onScrollTop} />

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quiet Progress Readout */}
          <div className="hidden items-center gap-3 pr-2 md:flex">
            <span className="font-mono text-xs text-zinc-400">
              {watchedCount}/{TOTAL_EPISODES}
            </span>
            <div className="h-[2px] w-20 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-crimson transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Favorites Filter Button */}
          <button
            type="button"
            onClick={onShowFavorites}
            title="Show Favorite Episodes"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              favoritesOnly
                ? "border-crimson bg-crimson/10 text-zinc-100"
                : "border-hairline bg-surface text-zinc-300 hover:border-zinc-700 hover:text-white"
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 ${
                favoritesCount > 0 ? "fill-crimson text-crimson" : "text-zinc-400"
              }`}
            />
            <span>Favorites</span>
            <span className="font-mono text-zinc-500">{favoritesCount}</span>
          </button>

          {/* Subtle Greeting Trigger */}
          <button
            type="button"
            onClick={onOpenGreeting}
            className="hidden rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 sm:inline-flex"
          >
            Welcome
          </button>
        </div>
      </div>
    </header>
  );
}
