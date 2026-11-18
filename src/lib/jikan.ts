import { TOTAL_EPISODES, generateFallbackEpisodes } from "@/lib/arcs";
import type { Episode, EpisodeCachePayload } from "@/types/anime";

const EPISODES_CACHE_KEY = "waleeds_clover_jikan_episodes_v2";
const CACHE_VERSION = 2;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

let inflightRequest: Promise<{
  episodes: Episode[];
  source: "jikan" | "fallback";
  fromCache: boolean;
}> | null = null;

export function readCachedEpisodes(): EpisodeCachePayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(EPISODES_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as EpisodeCachePayload;
    if (
      parsed.version !== CACHE_VERSION ||
      !Array.isArray(parsed.episodes) ||
      parsed.episodes.length !== TOTAL_EPISODES
    ) {
      return null;
    }

    if (Date.now() - parsed.cachedAt >= CACHE_TTL_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCachedEpisodes(payload: EpisodeCachePayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EPISODES_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export async function loadEpisodes(options?: {
  forceRefresh?: boolean;
}): Promise<{
  episodes: Episode[];
  source: "jikan" | "fallback";
  fromCache: boolean;
}> {
  if (!options?.forceRefresh) {
    const cached = readCachedEpisodes();
    if (cached && cached.source === "jikan") {
      return {
        episodes: cached.episodes,
        source: cached.source,
        fromCache: true,
      };
    }
  }

  // Deduplicate concurrent requests (prevents React StrictMode double-fetch)
  if (inflightRequest && !options?.forceRefresh) {
    return inflightRequest;
  }

  inflightRequest = (async () => {
    try {
      const response = await fetch("/api/episodes", {
        cache: options?.forceRefresh ? "no-store" : "default",
      });

      if (!response.ok) {
        throw new Error(`API route returned ${response.status}`);
      }

      const data = (await response.json()) as {
        source: "jikan" | "fallback";
        episodes: Episode[];
      };

      if (Array.isArray(data.episodes) && data.episodes.length === TOTAL_EPISODES) {
        if (data.source === "jikan") {
          writeCachedEpisodes({
            version: CACHE_VERSION,
            cachedAt: Date.now(),
            source: "jikan",
            episodes: data.episodes,
          });
        }
        return {
          episodes: data.episodes,
          source: data.source,
          fromCache: false,
        };
      }
    } catch {
      // Fall through to built-in fallback
    }

    return {
      episodes: generateFallbackEpisodes(),
      source: "fallback" as const,
      fromCache: false,
    };
  })();

  try {
    return await inflightRequest;
  } finally {
    inflightRequest = null;
  }
}
