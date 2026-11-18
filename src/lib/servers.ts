import { ANILIST_ID, MAL_ID, clampEpisodeNumber } from "@/lib/arcs";
import type { EmbedServer, ServerId } from "@/types/anime";

export const EMBED_SERVERS: EmbedServer[] = [
  {
    id: "animeembed-ani",
    name: "Server 1 — Primary (Sub)",
    shortLabel: "Server 1 • Primary",
    buildUrl: (ep) => {
      const safeEp = clampEpisodeNumber(ep);
      return `https://animeembed.com/embed/ani/${ANILIST_ID}/${safeEp}?track=sub&accent=dc2626`;
    },
  },
  {
    id: "animeembed-mal",
    name: "Server 2 — MAL Mirror",
    shortLabel: "Server 2 • MAL Mirror",
    buildUrl: (ep) => {
      const safeEp = clampEpisodeNumber(ep);
      return `https://animeembed.com/embed/mal/${MAL_ID}/${safeEp}?accent=dc2626`;
    },
  },
  {
    id: "animeembed-dub",
    name: "Server 3 — English Dub",
    shortLabel: "Server 3 • Dub",
    buildUrl: (ep) => {
      const safeEp = clampEpisodeNumber(ep);
      return `https://animeembed.com/embed/ani/${ANILIST_ID}/${safeEp}?track=dub&accent=dc2626`;
    },
  },
];

export function getServerById(id: ServerId): EmbedServer {
  return EMBED_SERVERS.find((s) => s.id === id) ?? EMBED_SERVERS[0];
}
