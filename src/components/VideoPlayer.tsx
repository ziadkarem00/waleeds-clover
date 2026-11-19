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
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  SlidersHorizontal,
  Subtitles,
} from "lucide-react";
import { TOTAL_EPISODES } from "@/lib/arcs";
import { EMBED_SERVERS, getServerById } from "@/lib/servers";
import { findActiveCue } from "@/lib/subtitles";
import type {
  CaptionMode,
  Episode,
  ServerId,
  SubtitleBackground,
  SubtitleColor,
  SubtitleCue,
  SubtitlePosition,
  SubtitleSettings,
  SubtitleSize,
} from "@/types/anime";

interface VideoPlayerProps {
  episode: Episode;
  activeServer: ServerId;
  onSelectServer: (server: ServerId) => void;
  captionMode: CaptionMode;
  onSelectCaptionMode: (mode: CaptionMode) => void;
  subtitleSettings: SubtitleSettings;
  onUpdateSubtitleSettings: (patch: Partial<SubtitleSettings>) => void;
  isWatched: boolean;
  isFavorite: boolean;
  onToggleWatched: (episodeNumber: number) => void;
  onToggleFavorite: (episodeNumber: number) => void;
  onSelectEpisode: (episodeNumber: number) => void;
  lightsOff: boolean;
  onToggleLightsOff: () => void;
}

const SIZE_CLASSES: Record<SubtitleSize, string> = {
  sm: "text-xs sm:text-base",
  md: "text-sm sm:text-xl",
  lg: "text-base sm:text-2xl",
  xl: "text-lg sm:text-3xl",
};

const POSITION_CLASSES: Record<SubtitlePosition, string> = {
  low: "bottom-7 sm:bottom-11",
  standard: "bottom-11 sm:bottom-16",
  high: "bottom-16 sm:bottom-24",
};

const BG_CLASSES: Record<SubtitleBackground, string> = {
  none: "bg-transparent px-2 py-0.5",
  subtle: "rounded-md bg-black/45 px-3.5 py-1 backdrop-blur-[2px]",
  box: "rounded-md bg-black/80 px-4 py-1.5",
};

const COLOR_CLASSES: Record<SubtitleColor, string> = {
  white: "text-white",
  yellow: "text-yellow-300",
};

const BASE_TEXT_SHADOW =
  "0 2px 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1), 1px 1px 0 rgba(0,0,0,0.95), -1px -1px 0 rgba(0,0,0,0.95), 1px -1px 0 rgba(0,0,0,0.95), -1px 1px 0 rgba(0,0,0,0.95)";

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
  subtitleSettings,
  onUpdateSubtitleSettings,
  isWatched,
  isFavorite,
  onToggleWatched,
  onToggleFavorite,
  onSelectEpisode,
  lightsOff,
  onToggleLightsOff,
}: VideoPlayerProps) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeOffset, setTimeOffset] = useState(0);
  const [showSubSettings, setShowSubSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const settingsPanelRef = useRef<HTMLDivElement | null>(null);
  const playerFrameRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const serverConfig = getServerById(activeServer);
  const embedUrl = serverConfig.buildUrl(episode.number);

  useEffect(() => {
    setIframeLoading(true);
    setCurrentTime(0);
    setIsPlaying(false);
    setTimeOffset(0);
  }, [episode.number, activeServer]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    if (!showSubSettings) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsPanelRef.current &&
        !settingsPanelRef.current.contains(event.target as Node)
      ) {
        setShowSubSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSubSettings]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.includes("animeembed.com")) return;
      if (
        iframeRef.current?.contentWindow &&
        event.source !== iframeRef.current.contentWindow
      ) {
        return;
      }
      const parsed = extractTimeFromMessage(event.data);
      if (typeof parsed.time === "number") {
        setCurrentTime(parsed.time);
      }
      if (typeof parsed.playing === "boolean") {
        setIsPlaying(parsed.playing);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setCurrentTime((t) => t + 0.25);
    }, 250);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  // Fetch synced subtitles for BOTH Arabic CC and English CC via our multi-provider route
  useEffect(() => {
    if (captionMode === "off") {
      setCues([]);
      setSubLoading(false);
      return;
    }

    let cancelled = false;
    setSubLoading(true);
    setCues([]);

    fetch(`/api/subtitles?episode=${episode.number}&lang=${captionMode}`)
      .then((res) => res.json())
      .then((data: { found?: boolean; cues?: SubtitleCue[] }) => {
        if (cancelled) return;
        if (data.found && Array.isArray(data.cues) && data.cues.length > 0) {
          setCues(data.cues);
        } else {
          setCues([]);
        }
        setSubLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setCues([]);
          setSubLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [episode.number, captionMode]);

  const handleToggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (playerFrameRef.current?.requestFullscreen) {
        await playerFrameRef.current.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen rejection on unsupported browsers
    }
  };

  const activeCue = useMemo(() => {
    if (captionMode === "off" || cues.length === 0) return null;
    return findActiveCue(cues, currentTime + timeOffset);
  }, [captionMode, cues, currentTime, timeOffset]);

  const isRtl = captionMode === "ar";
  const hasPrev = episode.number > 1;
  const hasNext = episode.number < TOTAL_EPISODES;

  return (
    <section
      className={`relative rounded-xl border transition-colors ${
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

      {/* 16:9 Cinema Video Frame + Unified Synced Subtitle Overlay (EN & AR) */}
      <div
        ref={playerFrameRef}
        className="relative aspect-video w-full overflow-hidden bg-black"
      >
        {iframeLoading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-obsidian/90">
            <Loader2 className="h-7 w-7 animate-spin text-crimson" />
            <p className="text-xs font-medium text-zinc-400">
              Loading Episode {episode.number} via {serverConfig.shortLabel}…
            </p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={embedUrl}
          src={embedUrl}
          title={`Black Clover Episode ${episode.number}: ${episode.title}`}
          className="h-full w-full border-0"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="no-referrer"
          onLoad={() => setIframeLoading(false)}
        />

        {/* Cinema-Style Subtitle Overlay (works for BOTH Arabic CC and English CC without reloading video) */}
        {captionMode !== "off" && activeCue && (
          <div
            className={`pointer-events-none absolute inset-x-3 z-20 flex justify-center sm:inset-x-6 ${
              POSITION_CLASSES[subtitleSettings.position]
            }`}
          >
            <div
              dir={isRtl ? "rtl" : "ltr"}
              style={{
                textShadow: BASE_TEXT_SHADOW,
                fontFamily: isRtl
                  ? "var(--font-subtitle-ar), Tahoma, system-ui, sans-serif"
                  : "var(--font-inter), system-ui, sans-serif",
              }}
              className={`max-w-[92%] text-center font-semibold leading-snug ${
                SIZE_CLASSES[subtitleSettings.size]
              } ${BG_CLASSES[subtitleSettings.background]} ${
                COLOR_CLASSES[subtitleSettings.color]
              }`}
            >
              {activeCue.text.split("\n").map((line, idx) => (
                <p
                  key={idx}
                  dir={isRtl ? "rtl" : "ltr"}
                  style={{ unicodeBidi: "isolate" }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Unified Controls Row 1: Server Switcher + Subtitles + Style */}
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

        {/* Subtitles Switcher + Style Settings */}
        <div
          className="relative flex flex-wrap items-center gap-2"
          ref={settingsPanelRef}
        >
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
                onClick={() => onSelectCaptionMode(opt.id)}
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

          {captionMode !== "off" && (
            <button
              type="button"
              onClick={() => setShowSubSettings((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                showSubSettings
                  ? "border-zinc-600 bg-zinc-800 text-white"
                  : "border-hairline bg-surface text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Style</span>
            </button>
          )}

          {captionMode !== "off" && subLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
          )}

          {/* Subtitle Style & Sync Popover */}
          {showSubSettings && captionMode !== "off" && (
            <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-xl border border-hairline bg-surface p-4 shadow-2xl sm:left-auto sm:right-0">
              <div className="mb-3 flex items-center justify-between border-b border-hairline pb-2">
                <span className="text-xs font-semibold text-zinc-200">
                  Subtitle Settings
                </span>
                {cues.length > 0 && (
                  <span className="font-mono text-[11px] text-zinc-500">
                    {cues.length} lines
                  </span>
                )}
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Text Size */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-medium text-zinc-400">
                    Size
                  </span>
                  <div className="grid grid-cols-4 gap-1 rounded-lg border border-hairline bg-obsidian p-0.5">
                    {(
                      [
                        { id: "sm", label: "S" },
                        { id: "md", label: "M" },
                        { id: "lg", label: "L" },
                        { id: "xl", label: "XL" },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onUpdateSubtitleSettings({ size: s.id })}
                        className={`rounded-md py-1 font-medium transition-colors ${
                          subtitleSettings.size === s.id
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Background Style */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-medium text-zinc-400">
                    Background
                  </span>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-hairline bg-obsidian p-0.5">
                    {(
                      [
                        { id: "none", label: "None" },
                        { id: "subtle", label: "Subtle" },
                        { id: "box", label: "Box" },
                      ] as const
                    ).map((bg) => (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() =>
                          onUpdateSubtitleSettings({ background: bg.id })
                        }
                        className={`rounded-md py-1 font-medium transition-colors ${
                          subtitleSettings.background === bg.id
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Color */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-medium text-zinc-400">
                    Color
                  </span>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-hairline bg-obsidian p-0.5">
                    {(
                      [
                        { id: "white", label: "White" },
                        { id: "yellow", label: "Yellow" },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onUpdateSubtitleSettings({ color: c.id })}
                        className={`rounded-md py-1 font-medium transition-colors ${
                          subtitleSettings.color === c.id
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vertical Position */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-medium text-zinc-400">
                    Position
                  </span>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-hairline bg-obsidian p-0.5">
                    {(
                      [
                        { id: "low", label: "Low" },
                        { id: "standard", label: "Standard" },
                        { id: "high", label: "High" },
                      ] as const
                    ).map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() =>
                          onUpdateSubtitleSettings({ position: pos.id })
                        }
                        className={`rounded-md py-1 font-medium transition-colors ${
                          subtitleSettings.position === pos.id
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timing Sync Offset */}
                <div className="flex items-center justify-between border-t border-hairline pt-3">
                  <span className="text-[11px] font-medium text-zinc-400">
                    Timing Sync
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setTimeOffset((o) => Number((o - 0.5).toFixed(1)))
                      }
                      className="rounded border border-hairline bg-obsidian p-1 text-zinc-400 hover:text-white"
                      title="Delay by 0.5s"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeOffset(0)}
                      className="min-w-[3.2rem] rounded border border-hairline bg-obsidian px-1.5 py-0.5 font-mono text-[11px] text-zinc-300 hover:text-white"
                      title="Reset timing"
                    >
                      {timeOffset >= 0
                        ? `+${timeOffset.toFixed(1)}s`
                        : `${timeOffset.toFixed(1)}s`}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTimeOffset((o) => Number((o + 0.5).toFixed(1)))
                      }
                      className="rounded border border-hairline bg-obsidian p-1 text-zinc-400 hover:text-white"
                      title="Advance by 0.5s"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
            onClick={handleToggleFullscreen}
            title="Fullscreen with subtitles visible"
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-obsidian px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span>{isFullscreen ? "Exit Full" : "Fullscreen"}</span>
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
