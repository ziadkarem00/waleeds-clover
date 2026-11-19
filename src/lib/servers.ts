import { ANILIST_ID, MAL_ID, clampEpisodeNumber } from "@/lib/arcs";
import type {
  CaptionMode,
  EmbedServer,
  ServerId,
  SubtitleSettings,
} from "@/types/anime";

export interface BuildEmbedOptions {
  captionMode: CaptionMode;
  subtitleSettings: SubtitleSettings;
}

const SIZE_MAP = {
  sm: "s",
  md: "m",
  lg: "l",
  xl: "xl",
} as const;

function buildAnimeEmbedParams(
  extraParams: Record<string, string>,
  options?: BuildEmbedOptions
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extraParams)) {
    params.set(key, value);
  }

  params.set("accent", "dc2626");
  // Hide the in-player settings gear and duplicate CC button so all controls live cleanly below
  params.set("hide", "settings,captions");

  if (options) {
    // Only enable AnimeEmbed's native English captions when English CC is selected;
    // turn native captions off for Arabic CC (so our synced Arabic overlay never overlaps English) and Off.
    params.set("captions", options.captionMode === "en" ? "en" : "off");
    params.set("captionSize", SIZE_MAP[options.subtitleSettings.size]);
    params.set(
      "captionColor",
      options.subtitleSettings.color === "yellow" ? "fde047" : "ffffff"
    );
    params.set(
      "captionBg",
      options.subtitleSettings.background === "box" ? "1" : "0"
    );
  }

  return params.toString();
}

export const EMBED_SERVERS: EmbedServer[] = [
  {
    id: "animeembed-ani",
    name: "Server 1 — Primary (Sub)",
    shortLabel: "Server 1 • Primary",
    buildUrl: (ep, options?: BuildEmbedOptions) => {
      const safeEp = clampEpisodeNumber(ep);
      const query = buildAnimeEmbedParams({ track: "sub" }, options);
      return `https://animeembed.com/embed/ani/${ANILIST_ID}/${safeEp}?${query}`;
    },
  },
  {
    id: "animeembed-mal",
    name: "Server 2 — MAL Mirror",
    shortLabel: "Server 2 • MAL Mirror",
    buildUrl: (ep, options?: BuildEmbedOptions) => {
      const safeEp = clampEpisodeNumber(ep);
      const query = buildAnimeEmbedParams({ track: "sub" }, options);
      return `https://animeembed.com/embed/mal/${MAL_ID}/${safeEp}?${query}`;
    },
  },
  {
    id: "animeembed-dub",
    name: "Server 3 — English Dub",
    shortLabel: "Server 3 • Dub",
    buildUrl: (ep, options?: BuildEmbedOptions) => {
      const safeEp = clampEpisodeNumber(ep);
      const query = buildAnimeEmbedParams({ track: "dub" }, options);
      return `https://animeembed.com/embed/ani/${ANILIST_ID}/${safeEp}?${query}`;
    },
  },
];

export function getServerById(id: ServerId): EmbedServer {
  return EMBED_SERVERS.find((s) => s.id === id) ?? EMBED_SERVERS[0];
}
