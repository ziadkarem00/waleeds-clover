import { NextRequest, NextResponse } from "next/server";
import { clampEpisodeNumber } from "@/lib/arcs";
import {
  decodeSubtitleBuffer,
  normalizeArabicCueText,
  parseSrtOrVtt,
} from "@/lib/subtitles";
import type { SubtitleCue } from "@/types/anime";

export const revalidate = 604800; // Cache resolved subtitles for 7 days on Vercel CDN

const BLACK_CLOVER_IMDB_ID = "tt7441658";
const ARABIC_CODES = new Set(["ara", "ar", "arb"]);
const ENGLISH_CODES = new Set(["eng", "en"]);
const SEPARATOR = "\n[[[SEP]]]\n";

interface StremioSubtitleItem {
  id?: string;
  url?: string;
  lang?: string;
}

interface StremioSubtitlesResponse {
  subtitles?: StremioSubtitleItem[];
}

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

async function fetchSubtitleFile(url: string): Promise<SubtitleCue[] | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "WaleedsClover/5.0" },
      next: { revalidate: 604800 },
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const decoded = decodeSubtitleBuffer(buffer);
    const cues = parseSrtOrVtt(decoded);
    return cues.length > 0 ? cues : null;
  } catch {
    return null;
  }
}

async function translateBatchToArabic(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  const joined = texts.join(SEPARATOR);

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(
      joined
    )}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 604800 },
    });

    if (!res.ok) return texts;
    const data = (await res.json()) as unknown[];
    const segments = Array.isArray(data[0]) ? (data[0] as unknown[][]) : [];
    const fullTranslated = segments
      .map((seg) => (typeof seg?.[0] === "string" ? seg[0] : ""))
      .join("");

    const parts = fullTranslated.split(/\s*\[\[\[SEP\]\]\]\s*/);
    if (parts.length === texts.length) {
      return parts.map((p, idx) =>
        normalizeArabicCueText(p.trim() || texts[idx])
      );
    }

    // Fallback: line-by-line split if separator count drifted
    const lineSplit = fullTranslated.split(/\n+/).filter(Boolean);
    if (lineSplit.length === texts.length) {
      return lineSplit.map((p) => normalizeArabicCueText(p.trim()));
    }

    return texts;
  } catch {
    return texts;
  }
}

async function translateCuesToArabic(cues: SubtitleCue[]): Promise<SubtitleCue[]> {
  // Chunk into batches under ~1,800 chars so Google Translate URLs stay fast and well within limits
  const batches: SubtitleCue[][] = [];
  let currentBatch: SubtitleCue[] = [];
  let currentChars = 0;

  for (const cue of cues) {
    const len = cue.text.length + SEPARATOR.length;
    if (currentBatch.length > 0 && (currentChars + len > 1600 || currentBatch.length >= 25)) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    currentBatch.push(cue);
    currentChars += len;
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  // Run batches in controlled parallel groups of 5 for fast response
  const translatedCues: SubtitleCue[] = [];
  for (let i = 0; i < batches.length; i += 5) {
    const group = batches.slice(i, i + 5);
    const results = await Promise.all(
      group.map(async (batch) => {
        const translatedTexts = await translateBatchToArabic(
          batch.map((c) => c.text.replace(/\n+/g, " "))
        );
        return batch.map((cue, idx) => ({
          start: cue.start,
          end: cue.end,
          text: translatedTexts[idx] ?? cue.text,
        }));
      })
    );
    for (const chunk of results) {
      translatedCues.push(...chunk);
    }
  }

  return translatedCues;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawEpisode = Number(searchParams.get("episode") ?? "1");
  const lang = searchParams.get("lang") === "en" ? "en" : "ar";
  const episode = clampEpisodeNumber(rawEpisode);

  const seasonPairs = getSeasonEpisodeCandidates(episode);

  try {
    // Fetch OpenSubtitles v3 catalogs across candidate season:episode pairs in parallel
    const catalogResults = await Promise.all(
      seasonPairs.map(async (pair) => {
        try {
          const catalogUrl = `https://opensubtitles-v3.strem.io/subtitles/series/${BLACK_CLOVER_IMDB_ID}:${pair.season}:${pair.ep}.json`;
          const res = await fetch(catalogUrl, {
            headers: {
              Accept: "application/json",
              "User-Agent": "WaleedsClover/5.0",
            },
            next: { revalidate: 604800 },
          });
          if (!res.ok) return [] as StremioSubtitleItem[];
          const json = (await res.json()) as StremioSubtitlesResponse;
          return Array.isArray(json.subtitles) ? json.subtitles : [];
        } catch {
          return [] as StremioSubtitleItem[];
        }
      })
    );

    const allItems = catalogResults.flat();

    const arabicCandidates = allItems.filter(
      (item) =>
        typeof item.url === "string" &&
        typeof item.lang === "string" &&
        ARABIC_CODES.has(item.lang.toLowerCase())
    );

    const englishCandidates = allItems.filter(
      (item) =>
        typeof item.url === "string" &&
        typeof item.lang === "string" &&
        ENGLISH_CODES.has(item.lang.toLowerCase())
    );

    // 1. If English requested, return native English track
    if (lang === "en") {
      for (const item of englishCandidates.slice(0, 3)) {
        if (!item.url) continue;
        const cues = await fetchSubtitleFile(item.url);
        if (cues) {
          return NextResponse.json(
            { found: true, lang: "en", source: "native", episode, count: cues.length, cues },
            { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } }
          );
        }
      }
      return NextResponse.json({ found: false, cues: [] });
    }

    // 2. Tier 1 for Arabic: Native Arabic subtitle track
    for (const item of arabicCandidates.slice(0, 4)) {
      if (!item.url) continue;
      const cues = await fetchSubtitleFile(item.url);
      if (cues) {
        return NextResponse.json(
          { found: true, lang: "ar", source: "native", episode, count: cues.length, cues },
          { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } }
        );
      }
    }

    // 3. Tier 2 for Arabic: Auto-translate native English track to Arabic (covers all 170 episodes!)
    for (const item of englishCandidates.slice(0, 3)) {
      if (!item.url) continue;
      const englishCues = await fetchSubtitleFile(item.url);
      if (englishCues) {
        const arabicCues = await translateCuesToArabic(englishCues);
        return NextResponse.json(
          {
            found: true,
            lang: "ar",
            source: "translated",
            episode,
            count: arabicCues.length,
            cues: arabicCues,
          },
          { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } }
        );
      }
    }

    return NextResponse.json({ found: false, cues: [] });
  } catch {
    return NextResponse.json({ found: false, cues: [] });
  }
}
