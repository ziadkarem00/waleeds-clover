import { clampEpisodeNumber } from "@/lib/arcs";
import type {
  CaptionMode,
  ServerId,
  SubtitleBackground,
  SubtitleColor,
  SubtitlePosition,
  SubtitleSettings,
  SubtitleSize,
  UserWatchState,
} from "@/types/anime";

const STORAGE_KEY = "waleeds_clover_watch_state_v3";

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  size: "md",
  background: "none",
  color: "white",
  position: "standard",
};

export const DEFAULT_WATCH_STATE: UserWatchState = {
  lastWatched: null,
  watchedEpisodes: [],
  favoriteEpisodes: [],
  preferredServer: "animeembed-ani",
  captionMode: "ar",
  subtitleSettings: DEFAULT_SUBTITLE_SETTINGS,
};

const VALID_SERVERS: ServerId[] = [
  "animeembed-ani",
  "animeembed-mal",
  "animeembed-dub",
];
const VALID_CAPTIONS: CaptionMode[] = ["en", "ar", "off"];
const VALID_SIZES: SubtitleSize[] = ["sm", "md", "lg", "xl"];
const VALID_BGS: SubtitleBackground[] = ["none", "subtle", "box"];
const VALID_COLORS: SubtitleColor[] = ["white", "yellow"];
const VALID_POSITIONS: SubtitlePosition[] = ["low", "standard", "high"];

export function loadWatchState(): UserWatchState {
  if (typeof window === "undefined") return DEFAULT_WATCH_STATE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WATCH_STATE;

    const parsed = JSON.parse(raw) as Partial<UserWatchState>;

    const watchedEpisodes = Array.isArray(parsed.watchedEpisodes)
      ? Array.from(
          new Set(
            parsed.watchedEpisodes
              .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
              .map(clampEpisodeNumber)
          )
        ).sort((a, b) => a - b)
      : [];

    const favoriteEpisodes = Array.isArray(parsed.favoriteEpisodes)
      ? Array.from(
          new Set(
            parsed.favoriteEpisodes
              .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
              .map(clampEpisodeNumber)
          )
        ).sort((a, b) => a - b)
      : [];

    const lastWatched =
      parsed.lastWatched && typeof parsed.lastWatched.episodeNumber === "number"
        ? {
            episodeNumber: clampEpisodeNumber(parsed.lastWatched.episodeNumber),
            updatedAt:
              typeof parsed.lastWatched.updatedAt === "string"
                ? parsed.lastWatched.updatedAt
                : new Date().toISOString(),
            status:
              parsed.lastWatched.status === "completed"
                ? ("completed" as const)
                : ("watching" as const),
          }
        : null;

    const preferredServer: ServerId =
      parsed.preferredServer && VALID_SERVERS.includes(parsed.preferredServer)
        ? parsed.preferredServer
        : "animeembed-ani";

    const captionMode: CaptionMode =
      parsed.captionMode && VALID_CAPTIONS.includes(parsed.captionMode)
        ? parsed.captionMode
        : "ar";

    const rawSub = parsed.subtitleSettings;
    const subtitleSettings: SubtitleSettings = {
      size:
        rawSub?.size && VALID_SIZES.includes(rawSub.size)
          ? rawSub.size
          : DEFAULT_SUBTITLE_SETTINGS.size,
      background:
        rawSub?.background && VALID_BGS.includes(rawSub.background)
          ? rawSub.background
          : DEFAULT_SUBTITLE_SETTINGS.background,
      color:
        rawSub?.color && VALID_COLORS.includes(rawSub.color)
          ? rawSub.color
          : DEFAULT_SUBTITLE_SETTINGS.color,
      position:
        rawSub?.position && VALID_POSITIONS.includes(rawSub.position)
          ? rawSub.position
          : DEFAULT_SUBTITLE_SETTINGS.position,
    };

    return {
      lastWatched,
      watchedEpisodes,
      favoriteEpisodes,
      preferredServer,
      captionMode,
      subtitleSettings,
    };
  } catch {
    return DEFAULT_WATCH_STATE;
  }
}

export function saveWatchState(state: UserWatchState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function formatRelativeTimestamp(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Recently";
  }
}
