"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { findActiveCues } from "@/lib/subtitles";
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

const FULLSCREEN_SIZE_CLASSES: Record<SubtitleSize, string> = {
  sm: "text-base sm:text-xl",
  md: "text-lg sm:text-2xl",
  lg: "text-xl sm:text-3xl",
  xl: "text-2xl sm:text-4xl",
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

function extractPlayerEvent(raw: unknown): {
  time?: number;
  state?: "playing" | "paused" | "buffering";
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

  let state: "playing" | "paused" | "buffering" | undefined;
  if (eventName === "play" || eventName === "playing") {
    state = "playing";
  } else if (
    eventName === "pause" ||
    eventName === "paused" ||
    eventName === "ended"
  ) {
    state = "paused";
  } else if (eventName === "buffering" || eventName === "waiting") {
    state = "buffering";
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
      return { time: val, state };
    }
  }

  return { state };
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
  const [timeOffset, setTimeOffset] = useState(0);
  const [showSubSettings, setShowSubSettings] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);

  const settingsPanelRef = useRef<HTMLDivElement | null>(null);
  const playerFrameRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // High-precision drift-free playback clock anchored to AnimeEmbed progress messages
  const syncAnchorRef = useRef<{
    baseTime: number;
    anchorPerf: number;
    playing: boolean;
    lastTickPerf: number;
  }>({
    baseTime: 0,
    anchorPerf: 0,
    playing: false,
    lastTickPerf: 0,
  });

  const serverConfig = getServerById(activeServer);
  const embedUrl = serverConfig.buildUrl(episode.number);

  const isAnyFullscreen = isNativeFullscreen || isFallbackFullscreen;

  // Reset clock cleanly on episode or server change
  useEffect(() => {
    setIframeLoading(true);
    setCurrentTime(0);
    setTimeOffset(0);
    syncAnchorRef.current = {
      baseTime: 0,
      anchorPerf: 0,
      playing: false,
      lastTickPerf: 0,
    };
  }, [episode.number, activeServer]);

  // Listen for native fullscreen exit / change
  useEffect(() => {
    const onFsChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Lock body scroll and support Escape key when using CSS fullscreen fallback (e.g., iOS)
  useEffect(() => {
    if (!isFallbackFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFallbackFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isFallbackFullscreen]);

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

  // Listen for AnimeEmbed PostMessage progress / play / pause / buffering events
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.includes("animeembed.com")) return;
      if (
        iframeRef.current?.contentWindow &&
        event.source !== iframeRef.current.contentWindow
      ) {
        return;
      }

      const parsed = extractPlayerEvent(event.data);
      const now = performance.now();
      const anchor = syncAnchorRef.current;

      if (typeof parsed.time === "number") {
        // Detect if time is advancing between ticks so subtitles start immediately
        // even if a browser omits an explicit 'play' event
        const wasAdvancing =
          anchor.lastTickPerf > 0 && parsed.time > anchor.baseTime + 0.01;
        anchor.baseTime = parsed.time;
        anchor.anchorPerf = now;
        anchor.lastTickPerf = now;
        if (parsed.state === "playing") {
          anchor.playing = true;
        } else if (parsed.state === "paused" || parsed.state === "buffering") {
          anchor.playing = false;
        } else if (wasAdvancing) {
          anchor.playing = true;
        }
        setCurrentTime(parsed.time);
      } else if (parsed.state) {
        if (parsed.state === "playing") {
          anchor.anchorPerf = now;
          anchor.playing = true;
        } else {
          if (anchor.playing && anchor.anchorPerf > 0) {
            anchor.baseTime += (now - anchor.anchorPerf) / 1000;
          }
          anchor.anchorPerf = now;
          anchor.playing = false;
          setCurrentTime(anchor.baseTime);
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Drift-free animation frame loop anchored to last player timestamp
  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const anchor = syncAnchorRef.current;
      if (anchor.playing && anchor.anchorPerf > 0) {
        const now = performance.now();
        // Safety cap: if player stops sending progress ticks for >3s (e.g. stalled), pause local drift
        const sinceLastTick =
          anchor.lastTickPerf > 0 ? (now - anchor.lastTickPerf) / 1000 : 0;
        if (sinceLastTick <= 3) {
          const exactTime = anchor.baseTime + (now - anchor.anchorPerf) / 1000;
          setCurrentTime((prev) =>
            Math.abs(exactTime - prev) >= 0.05 ? exactTime : prev
          );
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  // Fetch synced subtitles for BOTH Arabic CC and English CC
  useEffect(() => {
    if (captionMode === "off") {
      setCues([]);
      setSubLoading(false);
      return;
    }

    let cancelled = false;
    setSubLoading(true);
    setCues([]);

    fetch(`/api/subtitles?episode=${episode.number}&lang=${captionMode}&v=8`)
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

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFallbackFullscreen(false);
        return;
      }
      if (isFallbackFullscreen) {
        setIsFallbackFullscreen(false);
        return;
      }

      const container = playerFrameRef.current;
      if (container && typeof container.requestFullscreen === "function") {
        await container.requestFullscreen();
      } else {
        // Fallback for iOS Safari where div.requestFullscreen is unavailable
        setIsFallbackFullscreen(true);
      }
    } catch {
      setIsFallbackFullscreen((prev) => !prev);
    }
  }, [isFallbackFullscreen]);

  const activeCues = useMemo(() => {
    if (captionMode === "off" || cues.length === 0) return [];
    return findActiveCues(cues, currentTime + timeOffset);
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

      {/* 16:9 Cinema Video Frame + Unified Synced Subtitle Overlay (stays visible in Fullscreen!) */}
      <div
        ref={playerFrameRef}
        className={
          isFallbackFullscreen
            ? "fixed inset-0 z-[90] flex h-screen w-screen items-center justify-center bg-black"
            : "relative aspect-video w-full overflow-hidden bg-black"
        }
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
          allow="autoplay; encrypted-media"
          referrerPolicy="no-referrer"
          onLoad={() => setIframeLoading(false)}
        />

        {/* Custom Wrapper Fullscreen Button (replaces iframe fullscreen so subtitles NEVER vanish) */}
        <button
          type="button"
          onClick={handleToggleFullscreen}
          aria-label={isAnyFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          title={
            isAnyFullscreen
              ? "Exit Fullscreen"
              : "Fullscreen (with subtitles)"
          }
          className="absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/60 text-zinc-200 backdrop-blur-sm transition-colors hover:bg-black/85 hover:text-white"
        >
          {isAnyFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>

        {/* Cinema-Style Subtitle Overlay (works in normal AND fullscreen for both Arabic & English CC) */}
        {captionMode !== "off" && activeCues.length > 0 && (
          <div
            className={`pointer-events-none absolute inset-x-3 z-20 flex flex-col items-center gap-1 sm:inset-x-8 ${
              isAnyFullscreen
                ? "bottom-14 sm:bottom-20"
                : POSITION_CLASSES[subtitleSettings.position]
            }`}
          >
            {activeCues.map((cue, cueIdx) => (
              <div
                key={`${cue.start}-${cueIdx}`}
                dir={isRtl ? "rtl" : "ltr"}
                style={{
                  textShadow: BASE_TEXT_SHADOW,
                  fontFamily: isRtl
                    ? "var(--font-subtitle-ar), Tahoma, system-ui, sans-serif"
                    : "var(--font-inter), system-ui, sans-serif",
                }}
                className={`max-w-[92%] text-center font-semibold leading-snug ${
                  isAnyFullscreen
                    ? FULLSCREEN_SIZE_CLASSES[subtitleSettings.size]
                    : SIZE_CLASSES[subtitleSettings.size]
                } ${BG_CLASSES[subtitleSettings.background]} ${
                  COLOR_CLASSES[subtitleSettings.color]
                }`}
              >
                {cue.text.split("\n").map((line, idx) => (
                  <p
                    key={idx}
                    dir={isRtl ? "rtl" : "ltr"}
                    style={{ unicodeBidi: "isolate" }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            ))}
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
            {isAnyFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span>{isAnyFullscreen ? "Exit Full" : "Fullscreen"}</span>
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
