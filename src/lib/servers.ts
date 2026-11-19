import { ANILIST_ID, MAL_ID, clampEpisodeNumber } from "@/lib/arcs";
import type { EmbedServer, ServerId } from "@/types/anime";

function buildAnimeEmbedParams(extraParams: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extraParams)) {
    params.set(key, value);
  }

  params.set("accent", "dc2626");
  // Hide in-player settings & CC controls and disable native captions so our unified
  // multi-provider overlay handles BOTH English CC and Arabic CC reliably across all 170 episodes
  params.set("hide", "settings,captions");
  params.set("captions", "off");

  return params.toString();
}

export const EMBED_SERVERS: EmbedServer[] = [
  {
    id: "animeembed-ani",
    name: "Server 1 — Primary (Sub)",
    shortLabel: "Server 1 • Primary",
    buildUrl: (ep) => {
      const safeEp = clampEpisodeNumber(ep);
      const query = buildAnimeEmbedParams({ track: "sub" });
      return `https://animeembed.com/embed/ani/${ANILIST_ID}/${safeEp}?${query}`;
    },
  },
  {
    id: "animeembed-mal",
    name: "Server 2 — MAL Mirror",
    shortLabel: "Server 2 • MAL Mirror",
    buildUrl: (ep) => {
      const safeEp = clampEpisodeNumber(ep);
      const query = buildAnimeEmbedParams({ track: "sub" });
      return `https://animeembed.com/embed/mal/${MAL_ID}/${safeEp}?${query}`;
    },
  },
  {
    id: "animeembed-dub",
    name: "Server 3 — English Dub",
    shortLabel: "Server 3 • Dub",
    buildUrl: (ep) => {
      const safeEp = clampEpisodeNumber(ep);
      const query = buildAnimeEmbedParams({ track: "dub" });
      return `https://animeembed.com/embed/ani/${ANILIST_ID}/${safeEp}?${query}`;
    },
  },
];

export function getServerById(id: ServerId): EmbedServer {
  return EMBED_SERVERS.find((s) => s.id === id) ?? EMBED_SERVERS[0];
}
