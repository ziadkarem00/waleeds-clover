import { NextRequest, NextResponse } from "next/server";
import { clampEpisodeNumber } from "@/lib/arcs";
import { decodeSubtitleBuffer, parseSrtOrVtt } from "@/lib/subtitles";

export const revalidate = 86400; // Cache subtitle lookups for 24h

const BLACK_CLOVER_IMDB_ID = "tt7441658";

interface StremioSubtitleItem {
  id?: string;
  url?: string;
  lang?: string;
}

interface StremioSubtitlesResponse {
  subtitles?: StremioSubtitleItem[];
}

/**
 * OpenSubtitles / IMDb indexes Black Clover (Ep 1-170) across 4 seasons
 * (S1: 1-51, S2: 52-102, S3: 103-154, S4: 155-170), while some uploaders use
 * absolute Season 1 numbering (1:58). We build candidate season:episode pairs
 * to check both and ensure every episode 1-170 finds its Arabic track.
 */
function getSeasonEpisodeCandidates(
  absoluteEp: number
): Array<{ season: number; ep: number }> {
  const candidates: Array<{ season: number; ep: number }> = [];

  if (absoluteEp <= 51) {
    candidates.push({ season: 1, ep: absoluteEp });
  } else if (absoluteEp <= 102) {
    candidates.push({ season: 2, ep: absoluteEp - 51 });
    candidates.push({ season: 1, ep: absoluteEp });
  } else if (absoluteEp <= 154) {
    candidates.push({ season: 3, ep: absoluteEp - 102 });
    candidates.push({ season: 1, ep: absoluteEp });
  } else {
    candidates.push({ season: 4, ep: absoluteEp - 154 });
    candidates.push({ season: 1, ep: absoluteEp });
  }

  return candidates;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawEpisode = Number(searchParams.get("episode") ?? "1");
  const lang = searchParams.get("lang") === "en" ? "en" : "ar";
  const episode = clampEpisodeNumber(rawEpisode);

  const targetCodes =
    lang === "ar" ? new Set(["ara", "ar", "arb"]) : new Set(["eng", "en"]);

  const seasonPairs = getSeasonEpisodeCandidates(episode);

  try {
    for (const pair of seasonPairs) {
      const catalogUrl = `https://opensubtitles-v3.strem.io/subtitles/series/${BLACK_CLOVER_IMDB_ID}:${pair.season}:${pair.ep}.json`;
      const catalogRes = await fetch(catalogUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "WaleedsClover/4.0",
        },
        next: { revalidate: 86400 },
      });

      if (!catalogRes.ok) continue;

      const catalog = (await catalogRes.json()) as StremioSubtitlesResponse;
      const candidates = (catalog.subtitles ?? []).filter(
        (item) =>
          typeof item.url === "string" &&
          typeof item.lang === "string" &&
          targetCodes.has(item.lang.toLowerCase())
      );

      for (const candidate of candidates.slice(0, 4)) {
        if (!candidate.url) continue;
        try {
          const subRes = await fetch(candidate.url, {
            headers: { "User-Agent": "WaleedsClover/4.0" },
            next: { revalidate: 86400 },
          });
          if (!subRes.ok) continue;

          const buffer = await subRes.arrayBuffer();
          const decoded = decodeSubtitleBuffer(buffer);
          const cues = parseSrtOrVtt(decoded);

          if (cues.length > 0) {
            return NextResponse.json(
              {
                found: true,
                lang,
                episode,
                matchedSeason: pair.season,
                matchedEpisode: pair.ep,
                count: cues.length,
                cues,
              },
              {
                headers: {
                  "Cache-Control":
                    "public, s-maxage=86400, stale-while-revalidate=604800",
                },
              }
            );
          }
        } catch {
          continue;
        }
      }
    }

    return NextResponse.json({
      found: false,
      cues: [],
      message: `No ${lang === "ar" ? "Arabic" : "English"} subtitle track found for Episode ${episode}.`,
    });
  } catch {
    return NextResponse.json({
      found: false,
      cues: [],
      message: "Subtitle fetch failed.",
    });
  }
}
