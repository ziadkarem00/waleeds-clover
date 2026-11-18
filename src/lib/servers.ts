import { ANILIST_ID, MAL_ID, clampEpisodeNumber } from "@/lib/arcs";
import type { EmbedServer, ServerId } from "@/types/anime";

/**
 * Verified anime embed servers for Black Clover Season 1 (AniList 97940 / MAL 34572).
 * Note: Never append unsupported query params to animeembed.com, as it rejects unknown params.
 * Multi-language CC (Arabic & English) is available inside VidPlus and VidLink via the player's CC menu.
 */
export const EMBED_SERVERS: EmbedServer[] = [
  {
    id: "vidplus",
    name: "Server 1 — VidPlus (Multi-CC: EN / AR)",
    shortLabel: "Server 1 • VidPlus",
    supportsArabicCC: true,
    supportsSandbox: false,
    buildUrl: (ep) => {
      const safeEp = clampEpisodeNumber(ep);
      return `https://player.vidplus.to/embed/anime/${ANILIST_ID}/${safeEp}?dub=false`;
    },
  },
  {
    id: "vidlink",
    name: "Server 2 — VidLink (Multi-CC: EN / AR)",
    shortLabel: "Server 2 • VidLink",
    supportsArabicCC: true,
    supportsSandbox: false,
    buildUrl: (ep) => {
      const safeEp = clampEpisodeNumber(ep);
      return `https://vidlink.pro/anime/${MAL_ID}/${safeEp}/sub?primaryColor=dc2626&fallback=true`;
    },
  },
  {
    id: "animeembed-ani",
    name: "Server 3 — AnimeEmbed (AniList Sub)",
    shortLabel: "Server 3 • Primary",
    supportsArabicCC: false,
    supportsSandbox: false,
    buildUrl: (ep) => {
      const safeEp = clampEpisodeNumber(ep);
      return `https://animeembed.com/embed/ani/${ANILIST_ID}/${safeEp}?track=sub&accent=dc2626`;
    },
  },
  {
    id: "animeembed-mal",
    name: "Server 4 — AnimeEmbed (MAL Mirror)",
    shortLabel: "Server 4 • MAL Mirror",
    supportsArabicCC: false,
    supportsSandbox: false,
    buildUrl: (ep) => {
      const safeEp = clampEpisodeNumber(ep);
      return `https://animeembed.com/embed/mal/${MAL_ID}/${safeEp}?accent=dc2626`;
    },
  },
  {
    id: "animeembed-dub",
    name: "Server 5 — AnimeEmbed (English Dub)",
    shortLabel: "Server 5 • Dub",
    supportsArabicCC: false,
    supportsSandbox: false,
    buildUrl: (ep) => {
      const safeEp = clampEpisodeNumber(ep);
      return `https://animeembed.com/embed/ani/${ANILIST_ID}/${safeEp}?track=dub&accent=dc2626`;
    },
  },
];

export function getServerById(id: ServerId): EmbedServer {
  return EMBED_SERVERS.find((s) => s.id === id) ?? EMBED_SERVERS[0];
}
