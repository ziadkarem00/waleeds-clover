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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawEpisode = Number(searchParams.get("episode") ?? "1");
  const lang = searchParams.get("lang") === "en" ? "en" : "ar";
  const episode = clampEpisodeNumber(rawEpisode);

  const targetCodes =
    lang === "ar" ? new Set(["ara", "ar", "arb"]) : new Set(["eng", "en"]);

  try {
    const catalogUrl = `https://opensubtitles-v3.strem.io/subtitles/series/${BLACK_CLOVER_IMDB_ID}:1:${episode}.json`;
    const catalogRes = await fetch(catalogUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "WaleedsClover/3.0",
      },
      next: { revalidate: 86400 },
    });

    if (!catalogRes.ok) {
      return NextResponse.json({
        found: false,
        cues: [],
        message: "Subtitle catalog unavailable for this episode.",
      });
    }

    const catalog = (await catalogRes.json()) as StremioSubtitlesResponse;
    const candidates = (catalog.subtitles ?? []).filter(
      (item) =>
        typeof item.url === "string" &&
        typeof item.lang === "string" &&
        targetCodes.has(item.lang.toLowerCase())
    );

    if (candidates.length === 0) {
      return NextResponse.json({
        found: false,
        cues: [],
        message: `No ${lang === "ar" ? "Arabic" : "English"} track found on OpenSubtitles for Ep ${episode}.`,
      });
    }

    // Try up to 3 candidate subtitle files in case one mirror fails
    for (const candidate of candidates.slice(0, 3)) {
      if (!candidate.url) continue;
      try {
        const subRes = await fetch(candidate.url, {
          headers: { "User-Agent": "WaleedsClover/3.0" },
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

    return NextResponse.json({
      found: false,
      cues: [],
      message: "Could not parse subtitle track for this episode.",
    });
  } catch {
    return NextResponse.json({
      found: false,
      cues: [],
      message: "Subtitle fetch failed.",
    });
  }
}
