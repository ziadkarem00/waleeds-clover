import { NextResponse } from "next/server";
import {
  MAL_ID,
  TOTAL_EPISODES,
  generateFallbackEpisodes,
  getArcForEpisode,
} from "@/lib/arcs";
import type { Episode } from "@/types/anime";

export const revalidate = 86400; // Cache server-side for 24 hours on Vercel

interface JikanEpisodeRaw {
  mal_id: number;
  title?: string | null;
  title_romanji?: string | null;
  aired?: string | null;
  filler?: boolean;
  recap?: boolean;
}

interface JikanEpisodesResponse {
  data?: JikanEpisodeRaw[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJikanPageWithRetry(page: number): Promise<JikanEpisodeRaw[]> {
  const url = `https://api.jikan.moe/v4/anime/${MAL_ID}/episodes?page=${page}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "WaleedsClover/2.0",
      },
      next: { revalidate: 86400 },
    });

    if (response.status === 429) {
      await sleep(700 * (attempt + 1));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Jikan HTTP ${response.status} on page ${page}`);
    }

    const json = (await response.json()) as JikanEpisodesResponse;
    return Array.isArray(json.data) ? json.data : [];
  }

  throw new Error(`Jikan rate-limited after retries on page ${page}`);
}

export async function GET() {
  const fallbackList = generateFallbackEpisodes();

  try {
    const page1 = await fetchJikanPageWithRetry(1);
    await sleep(500);
    const page2 = await fetchJikanPageWithRetry(2);

    const byNumber = new Map<number, JikanEpisodeRaw>();
    for (const item of [...page1, ...page2]) {
      if (
        typeof item.mal_id === "number" &&
        item.mal_id >= 1 &&
        item.mal_id <= TOTAL_EPISODES
      ) {
        byNumber.set(item.mal_id, item);
      }
    }

    if (byNumber.size === 0) {
      return NextResponse.json({
        source: "fallback",
        episodes: fallbackList,
      });
    }

    const mergedEpisodes: Episode[] = fallbackList.map((fallbackEp) => {
      const apiEp = byNumber.get(fallbackEp.number);
      if (!apiEp) return fallbackEp;

      const arc = getArcForEpisode(fallbackEp.number);
      return {
        number: fallbackEp.number,
        title: apiEp.title?.trim() || fallbackEp.title,
        titleRomaji: apiEp.title_romanji?.trim() || fallbackEp.titleRomaji,
        aired: apiEp.aired ?? null,
        filler: Boolean(apiEp.filler),
        recap: Boolean(apiEp.recap),
        arcId: arc.arcId,
        arcName: arc.arcName,
      };
    });

    return NextResponse.json(
      {
        source: "jikan",
        episodes: mergedEpisodes,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch {
    return NextResponse.json({
      source: "fallback",
      episodes: fallbackList,
    });
  }
}
