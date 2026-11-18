"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Lightbulb,
  LightbulbOff,
  Loader2,
  Shield,
  Subtitles,
} from "lucide-react";
import { TOTAL_EPISODES } from "@/lib/arcs";
import { EMBED_SERVERS, getServerById } from "@/lib/servers";
import type { CaptionLanguage, Episode, ServerId } from "@/types/anime";

interface VideoPlayerProps {
  episode: Episode;
  activeServer: ServerId;
  onSelectServer: (server: ServerId) => void;
  captionLanguage: CaptionLanguage;
  onSelectCaptionLanguage: (lang: CaptionLanguage) => void;
  isWatched: boolean;
  isFavorite: boolean;
  onToggleWatched: (episodeNumber: number) => void;
  onToggleFavorite: (episodeNumber: number) => void;
  onSelectEpisode: (episodeNumber: number) => void;
  lightsOff: boolean;
  onToggleLightsOff: () => void;
  adShieldEnabled: boolean;
  onToggleAdShield: () => void;
}

export function VideoPlayer({
  episode,
  activeServer,
  onSelectServer,
  captionLanguage,
  onSelectCaptionLanguage,
  isWatched,
  isFavorite,
  onToggleWatched,
  onToggleFavorite,
  onSelectEpisode,
  lightsOff,
  onToggleLightsOff,
  adShieldEnabled,
  onToggleAdShield,
}: VideoPlayerProps) {
  const [iframeLoading, setIframeLoading] = useState(true);

  const serverConfig = getServerById(activeServer);
  const embedUrl = serverConfig.buildUrl(episode.number);

  useEffect(() => {
    setIframeLoading(true);
  }, [embedUrl, adShieldEnabled]);

  const hasPrev = episode.number > 1;
  const hasNext = episode.number < TOTAL_EPISODES;

  return (
    <section
      className={`relative overflow-hidden rounded-xl border transition-colors ${
        lightsOff
          ? "z-50 border-zinc-700 bg-obsidian"
          : "border-hairline bg-surface"
      }`}
    >
      {/* Top Episode Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono font-semibold text-crimson">
              EP {String(episode.number).padStart(3, "0")}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">{episode.arcName}</span>
            {episode.filler && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-300">
                  Filler
                </span>
              </>
            )}
          </div>

          <h3 className="mt-1 truncate text-base font-semibold text-zinc-100 sm:text-lg">
            {episode.title}
          </h3>
          {episode.titleRomaji && episode.titleRomaji !== episode.title && (
            <p className="truncate text-xs text-zinc-500">
              {episode.titleRomaji}
            </p>
          )}
        </div>

        {lightsOff && (
          <button
            type="button"
            onClick={onToggleLightsOff}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            <span>Lights On</span>
          </button>
        )}
      </div>

      {/* 16:9 Cinema Video Frame */}
      <div className="relative aspect-video w-full bg-black">
        {iframeLoading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-obsidian/90">
            <Loader2 className="h-7 w-7 animate-spin text-crimson" />
            <p className="text-xs font-medium text-zinc-400">
              Loading Episode {episode.number} via {serverConfig.shortLabel}…
            </p>
          </div>
        )}

        <iframe
          key={`${embedUrl}-${adShieldEnabled ? "sandbox" : "open"}`}
          src={embedUrl}
          title={`Black Clover Episode ${episode.number}: ${episode.title}`}
          className="h-full w-full border-0"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="no-referrer"
          sandbox={
            adShieldEnabled
              ? "allow-scripts allow-same-origin allow-presentation allow-forms"
              : undefined
          }
          onLoad={() => setIframeLoading(false)}
        />
      </div>

      {/* Row 1: Server Switcher + English / Arabic CC Selector */}
      <div className="flex flex-col gap-3 border-t border-hairline bg-obsidian/50 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Server Switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Server
          </span>
          {EMBED_SERVERS.map((server) => {
            const isActive = server.id === activeServer;
            return (
              <button
                key={server.id}
                type="button"
                onClick={() => onSelectServer(server.id)}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-crimson bg-crimson text-white"
                    : "border-hairline bg-surface text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {server.shortLabel}
              </button>
            );
          })}
        </div>

        {/* Captions Language Switcher (English CC / Arabic CC) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            <Subtitles className="h-3.5 w-3.5" />
            CC
          </span>
          <div className="inline-flex rounded-lg border border-hairline bg-obsidian p-0.5">
            <button
              type="button"
              onClick={() => onSelectCaptionLanguage("en")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                captionLanguage === "en"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              English CC
            </button>
            <button
              type="button"
              onClick={() => onSelectCaptionLanguage("ar")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                captionLanguage === "ar"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Arabic CC
            </button>
          </div>
        </div>
      </div>

      {/* Subtle CC & Sandbox Helper Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline/60 bg-obsidian/30 px-4 py-2 text-[11px] text-zinc-500 sm:px-5">
        <span>
          {captionLanguage === "ar"
            ? serverConfig.supportsArabicCC
              ? "Arabic CC active — open the CC icon inside the player and select Arabic."
              : "Switch to Server 1 (VidPlus) or Server 2 (VidLink) for Arabic captions."
            : "English CC active — if a server is slow or unavailable, switch servers above."}
        </span>

        <button
          type="button"
          onClick={onToggleAdShield}
          className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
            adShieldEnabled
              ? "bg-zinc-800 text-zinc-200"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
          title="Enables iframe sandboxing to block popups. Turn off if a server refuses to play."
        >
          <Shield className="h-3 w-3" />
          <span>Ad-Shield Sandbox: {adShieldEnabled ? "On" : "Off"}</span>
        </button>
      </div>

      {/* Row 2: Episode Navigation & Watch Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-hairline px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => hasPrev && onSelectEpisode(episode.number - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-obsidian px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => hasNext && onSelectEpisode(episode.number + 1)}
            className="inline-flex items-center gap-1 rounded-lg bg-crimson px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>Next Episode</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleWatched(episode.number)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              isWatched
                ? "border-zinc-600 bg-zinc-800 text-white"
                : "border-hairline bg-obsidian text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            <span>{isWatched ? "Watched" : "Mark Watched"}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleFavorite(episode.number)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              isFavorite
                ? "border-crimson/60 bg-crimson/10 text-zinc-100"
                : "border-hairline bg-obsidian text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 ${
                isFavorite ? "fill-crimson text-crimson" : ""
              }`}
            />
            <span>{isFavorite ? "Favorited" : "Favorite"}</span>
          </button>

          <button
            type="button"
            onClick={onToggleLightsOff}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              lightsOff
                ? "border-zinc-600 bg-zinc-800 text-white"
                : "border-hairline bg-obsidian text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            {lightsOff ? (
              <Lightbulb className="h-3.5 w-3.5" />
            ) : (
              <LightbulbOff className="h-3.5 w-3.5" />
            )}
            <span>{lightsOff ? "Lights On" : "Lights Off"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
