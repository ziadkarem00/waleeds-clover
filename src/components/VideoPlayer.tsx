"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Lightbulb,
  LightbulbOff,
  Loader2,
  Minus,
  Plus,
  Subtitles,
  Upload,
} from "lucide-react";
import { TOTAL_EPISODES } from "@/lib/arcs";
import { EMBED_SERVERS, getServerById } from "@/lib/servers";
import {
  decodeSubtitleBuffer,
  findActiveCue,
  parseSrtOrVtt,
} from "@/lib/subtitles";
import type {
  CaptionMode,
  Episode,
  ServerId,
  SubtitleCue,
} from "@/types/anime";

interface VideoPlayerProps {
  episode: Episode;
  activeServer: ServerId;
  onSelectServer: (server: ServerId) => void;
  captionMode: CaptionMode;
  onSelectCaptionMode: (mode: CaptionMode) => void;
  isWatched: boolean;
  isFavorite: boolean;
  onToggleWatched: (episodeNumber: number) => void;
  onToggleFavorite: (episodeNumber: number) => void;
  onSelectEpisode: (episodeNumber: number) => void;
  lightsOff: boolean;
  onToggleLightsOff: () => void;
}

function extractTimeFromMessage(raw: unknown): {
  time?: number;
  playing?: boolean;
} {
  let data: unknown = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return {};
    }
  }
  if (!data || typeof data !== "object") return {};

  const obj = data as Record<string, unknown>;
  const nested =
    (obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>)
      : null) ??
    (obj.payload && typeof obj.payload === "object"
      ? (obj.payload as Record<string, unknown>)
      : null);

  const eventName = String(
    obj.event ?? obj.type ?? nested?.event ?? ""
  ).toLowerCase();

  let playing: boolean | undefined;
  if (eventName === "play" || eventName === "playing") playing = true;
  if (eventName === "pause" || eventName === "paused" || eventName === "ended") {
    playing = false;
  }

  const candidateValues = [
    obj.currentTime,
    obj.time,
    obj.position,
    nested?.currentTime,
    nested?.time,
    nested?.position,
  ];

  for (const val of candidateValues) {
    if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
      return { time: val, playing };
    }
  }

  return { playing };
}

export function VideoPlayer({
  episode,
  activeServer,
  onSelectServer,
  captionMode,
  onSelectCaptionMode,
  isWatched,
  isFavorite,
  onToggleWatched,
  onToggleFavorite,
  onSelectEpisode,
  lightsOff,
  onToggleLightsOff,
}: VideoPlayerProps) {
  const [iframeLoading, setIframeLoading] = useState(true);

  // Synced subtitle overlay state (used for Arabic CC or uploaded .srt/.vtt)
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [subStatus, setSubStatus] = useState<
    "idle" | "loading" | "ready" | "missing"
  >("idle");
  const [customSubName, setCustomSubName] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSyncedWithPlayer, setIsSyncedWithPlayer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeOffset, setTimeOffset] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const serverConfig = getServerById(activeServer);
  const embedUrl = serverConfig.buildUrl(episode.number);

  // Reset loading & player clock on episode or server change
  useEffect(() => {
    setIframeLoading(true);
    setCurrentTime(0);
    setIsSyncedWithPlayer(false);
    setIsPlaying(false);
    setTimeOffset(0);
    setCustomSubName(null);
  }, [embedUrl]);

  // Listen for AnimeEmbed PostMessage progress / play / pause events
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.includes("animeembed.com")) return;
      const parsed = extractTimeFromMessage(event.data);
      if (typeof parsed.time === "number") {
        setCurrentTime(parsed.time);
        setIsSyncedWithPlayer(true);
      }
      if (typeof parsed.playing === "boolean") {
        setIsPlaying(parsed.playing);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Smooth local clock interpolation while playing between postMessage ticks
  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setCurrentTime((t) => t + 0.25);
    }, 250);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  // Fetch Arabic subtitle cues when Arabic CC mode is selected
  useEffect(() => {
    if (captionMode !== "ar" || customSubName) {
      if (captionMode !== "ar") {
        setCues([]);
        setSubStatus("idle");
      }
      return;
    }

    let cancelled = false;
    setSubStatus("loading");
    setCues([]);

    fetch(`/api/subtitles?episode=${episode.number}&lang=ar`)
      .then((res) => res.json())
      .then((data: { found?: boolean; cues?: SubtitleCue[] }) => {
        if (cancelled) return;
        if (data.found && Array.isArray(data.cues) && data.cues.length > 0) {
          setCues(data.cues);
          setSubStatus("ready");
        } else {
          setCues([]);
          setSubStatus("missing");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCues([]);
          setSubStatus("missing");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [episode.number, captionMode, customSubName]);

  const handleUploadSubtitle = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const text = decodeSubtitleBuffer(buffer);
      const parsed = parseSrtOrVtt(text);
      if (parsed.length > 0) {
        setCues(parsed);
        setCustomSubName(file.name);
        setSubStatus("ready");
        onSelectCaptionMode("ar");
      }
    } finally {
      event.target.value = "";
    }
  };

  const activeCue = useMemo(() => {
    if (captionMode !== "ar" || cues.length === 0) return null;
    return findActiveCue(cues, currentTime + timeOffset);
  }, [captionMode, cues, currentTime, timeOffset]);

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

      {/* 16:9 Cinema Video Frame + Synced Arabic Subtitle Overlay */}
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
          key={embedUrl}
          src={embedUrl}
          title={`Black Clover Episode ${episode.number}: ${episode.title}`}
          className="h-full w-full border-0"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="no-referrer"
          onLoad={() => setIframeLoading(false)}
        />

        {/* Synced Arabic Subtitle Overlay (non-blocking pointer-events-none) */}
        {captionMode === "ar" && activeCue && (
          <div className="pointer-events-none absolute inset-x-4 bottom-14 z-20 flex justify-center sm:bottom-16">
            <div
              dir="rtl"
              className="max-w-[90%] whitespace-pre-line rounded-md bg-black/80 px-4 py-1.5 text-center text-sm font-medium leading-relaxed text-white shadow-lg sm:text-lg"
            >
              {activeCue.text}
            </div>
          </div>
        )}
      </div>

      {/* Unified Controls Row 1: Server Switcher + Working Captions Controls */}
      <div className="flex flex-col gap-3 border-t border-hairline bg-obsidian/50 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        {/* 3 Working Servers */}
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

        {/* Captions Selector (Arabic CC / English CC / Off) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            <Subtitles className="h-3.5 w-3.5" />
            Subtitles
          </span>

          <div className="inline-flex rounded-lg border border-hairline bg-obsidian p-0.5">
            {(
              [
                { id: "ar", label: "Arabic CC" },
                { id: "en", label: "English CC" },
                { id: "off", label: "Off" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setCustomSubName(null);
                  onSelectCaptionMode(opt.id);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  captionMode === opt.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Load Custom .srt/.vtt File */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".srt,.vtt"
            onChange={handleUploadSubtitle}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Load a local .srt or .vtt Arabic subtitle file"
            className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            <Upload className="h-3 w-3" />
            <span>Load .srt</span>
          </button>
        </div>
      </div>

      {/* Live Subtitle Status & Timing Sync Strip (only when Arabic CC is active) */}
      {captionMode === "ar" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline/60 bg-obsidian/30 px-4 py-2 text-[11px] text-zinc-400 sm:px-5">
          <span>
            {subStatus === "loading" && "Loading Arabic subtitle track…"}
            {subStatus === "ready" &&
              `${customSubName ? customSubName : "Arabic subtitles"} ready (${
                cues.length
              } lines)${
                isSyncedWithPlayer
                  ? " · Synced to player"
                  : " · Press play in the video to start sync"
              }`}
            {subStatus === "missing" &&
              `No Arabic track found online for Episode ${episode.number}. Click "Load .srt" to drop your own file.`}
          </span>

          {subStatus === "ready" && (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Sync:</span>
              <button
                type="button"
                onClick={() => setTimeOffset((o) => Number((o - 0.5).toFixed(1)))}
                className="rounded border border-hairline bg-surface p-1 text-zinc-400 hover:text-white"
                title="Delay subtitles by 0.5s"
              >
                <Minus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setTimeOffset(0)}
                className="min-w-[3rem] rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[11px] text-zinc-300 hover:text-white"
                title="Reset sync offset"
              >
                {timeOffset >= 0 ? `+${timeOffset.toFixed(1)}s` : `${timeOffset.toFixed(1)}s`}
              </button>
              <button
                type="button"
                onClick={() => setTimeOffset((o) => Number((o + 0.5).toFixed(1)))}
                className="rounded border border-hairline bg-surface p-1 text-zinc-400 hover:text-white"
                title="Advance subtitles by 0.5s"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Unified Controls Row 2: Episode Navigation & Watch Actions */}
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
