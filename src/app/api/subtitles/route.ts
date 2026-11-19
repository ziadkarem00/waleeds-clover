import { NextRequest, NextResponse } from "next/server";
import { clampEpisodeNumber } from "@/lib/arcs";
import {
  decodeSubtitleBuffer,
  normalizeArabicCueText,
  parseSrtOrVtt,
} from "@/lib/subtitles";
import type { SubtitleCue } from "@/types/anime";

export const revalidate = 604800;

const BLACK_CLOVER_IMDB_ID = "tt7441658";
const ARABIC_CODES = new Set(["ara", "ar", "arb"]);
const ENGLISH_CODES = new Set(["eng", "en"]);
const ARABIC_CHAR_RE = /[\u0600-\u06FF]/;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface StremioSubtitleItem {
  id?: string;
  url?: string;
  lang?: string;
}

interface StremioSubtitlesResponse {
  subtitles?: StremioSubtitleItem[];
}

function hasArabicContent(cues: SubtitleCue[]): boolean {
  const sample = cues.slice(0, 25);
  const arabicCount = sample.filter((c) => ARABIC_CHAR_RE.test(c.text)).length;
  return arabicCount >= Math.max(1, Math.floor(sample.length * 0.4));
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
      headers: { "User-Agent": BROWSER_UA },
      next: { revalidate: 604800 },
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 32) return null;
    const decoded = decodeSubtitleBuffer(buffer);
    const cues = parseSrtOrVtt(decoded);
    return cues.length > 0 ? cues : null;
  } catch {
    return null;
  }
}

function matchesBlackCloverEpisode(rawHref: string, ep: number): boolean {
  let decoded = rawHref;
  try {
    decoded = decodeURIComponent(rawHref);
  } catch {
    // keep raw
  }
  const lower = decoded.toLowerCase();
  if (!lower.includes("black") || !lower.includes("clover")) return false;

  const padded2 = String(ep).padStart(2, "0");
  const padded3 = String(ep).padStart(3, "0");
  const exactPatterns = [
    new RegExp(`(?:^|[^0-9])(?:ep?\\s*|s0?1e|[-_\\s])0*${ep}(?:[^0-9]|$)`, "i"),
    new RegExp(`\\b${padded3}\\b`),
    new RegExp(`\\b${padded2}\\b`),
  ];

  return exactPatterns.some((re) => re.test(lower));
}

function resolveSubtitleCatUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  const clean = href.startsWith("/") ? href : `/${href}`;
  return `https://www.subtitlecat.com${clean}`;
}

async function fetchFromSubtitleCat(
  episode: number
): Promise<{ arUrl?: string; enUrl?: string }> {
  const padded2 = String(episode).padStart(2, "0");
  const queries = [
    `Black Clover - ${padded2}`,
    `Black Clover - ${episode}`,
    `Black Clover S01E${padded2}`,
  ];

  const seenPages = new Set<string>();
  const detailPages: string[] = [];

  for (const query of queries) {
    if (detailPages.length >= 3) break;
    try {
      const searchUrl = `https://www.subtitlecat.com/index.php?search=${encodeURIComponent(
        query
      )}`;
      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml",
        },
        next: { revalidate: 604800 },
      });
      if (!res.ok) continue;

      const html = await res.text();
      const linkRe = /href="([^"]*subs\/\d+\/[^"]+\.html)"/gi;
      let match: RegExpExecArray | null;
      while ((match = linkRe.exec(html)) !== null) {
        const href = match[1];
        if (!href || seenPages.has(href)) continue;
        if (matchesBlackCloverEpisode(href, episode)) {
          seenPages.add(href);
          detailPages.push(resolveSubtitleCatUrl(href));
          if (detailPages.length >= 3) break;
        }
      }
    } catch {
      continue;
    }
  }

  let arUrl: string | undefined;
  let enUrl: string | undefined;

  for (const pageUrl of detailPages) {
    try {
      const res = await fetch(pageUrl, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml",
        },
        next: { revalidate: 604800 },
      });
      if (!res.ok) continue;
      const html = await res.text();

      if (!arUrl) {
        const arMatch =
          html.match(/id="download_ar"[^>]*href="([^"]+\.srt)"/i) ??
          html.match(/href="([^"]+\.srt)"[^>]*id="download_ar"/i);
        if (arMatch?.[1]) arUrl = resolveSubtitleCatUrl(arMatch[1]);
      }

      if (!enUrl) {
        const enMatch =
          html.match(/id="download_en"[^>]*href="([^"]+\.srt)"/i) ??
          html.match(/href="([^"]+\.srt)"[^>]*id="download_en"/i) ??
          html.match(/href="([^"]*subs\/\d+\/[^"]+\.srt)"/i);
        if (enMatch?.[1]) enUrl = resolveSubtitleCatUrl(enMatch[1]);
      }

      if (arUrl && enUrl) break;
    } catch {
      continue;
    }
  }

  return { arUrl, enUrl };
}

async function fetchFromOpenSubtitles(
  episode: number
): Promise<{ arUrls: string[]; enUrls: string[] }> {
  const seasonPairs = getSeasonEpisodeCandidates(episode);

  const catalogResults = await Promise.all(
    seasonPairs.map(async (pair) => {
      try {
        const catalogUrl = `https://opensubtitles-v3.strem.io/subtitles/series/${BLACK_CLOVER_IMDB_ID}:${pair.season}:${pair.ep}.json`;
        const res = await fetch(catalogUrl, {
          headers: {
            Accept: "application/json",
            "User-Agent": "WaleedsClover/8.0",
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
  const arUrls = allItems
    .filter(
      (item): item is Required<Pick<StremioSubtitleItem, "url" | "lang">> =>
        typeof item.url === "string" &&
        typeof item.lang === "string" &&
        ARABIC_CODES.has(item.lang.toLowerCase())
    )
    .map((item) => item.url);

  const enUrls = allItems
    .filter(
      (item): item is Required<Pick<StremioSubtitleItem, "url" | "lang">> =>
        typeof item.url === "string" &&
        typeof item.lang === "string" &&
        ENGLISH_CODES.has(item.lang.toLowerCase())
    )
    .map((item) => item.url);

  return { arUrls, enUrls };
}

/**
 * Translates an array of single-line English strings to Arabic using newline separation.
 * Google Translate preserves '\n' line boundaries reliably when each cue is a single line.
 * If a batch's line count ever mismatches, it recursively splits in half so no cue stays English.
 */
async function translateLinesToArabic(lines: string[]): Promise<string[]> {
  if (lines.length === 0) return [];

  const sanitized = lines.map((l) => l.replace(/\s+/g, " ").trim() || " ");
  const payload = sanitized.join("\n");

  try {
    const res = await fetch(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": BROWSER_UA,
        },
        body: new URLSearchParams({ q: payload }).toString(),
      }
    );

    if (!res.ok) {
      throw new Error(`Translate HTTP ${res.status}`);
    }

    const data = (await res.json()) as unknown[];
    const segments = Array.isArray(data[0]) ? (data[0] as unknown[][]) : [];
    const fullText = segments
      .map((seg) => (typeof seg?.[0] === "string" ? seg[0] : ""))
      .join("");

    const translatedLines = fullText.split("\n");

    if (translatedLines.length === sanitized.length) {
      return translatedLines.map((line, i) =>
        normalizeArabicCueText(line.trim() || sanitized[i])
      );
    }

    // If line count drifted and we have multiple lines, split in half and retry cleanly
    if (sanitized.length > 1) {
      const mid = Math.ceil(sanitized.length / 2);
      const [left, right] = await Promise.all([
        translateLinesToArabic(sanitized.slice(0, mid)),
        translateLinesToArabic(sanitized.slice(mid)),
      ]);
      return [...left, ...right];
    }

    // Single-line response: join any extra newlines back into one clean Arabic line
    return [normalizeArabicCueText(fullText.replace(/\s+/g, " ").trim())];
  } catch {
    // Fallback to MyMemory free endpoint for single lines if Google Translate fails
    if (sanitized.length === 1) {
      try {
        const mmRes = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
            sanitized[0]
          )}&langpair=en|ar`
        );
        if (mmRes.ok) {
          const mm = (await mmRes.json()) as {
            responseData?: { translatedText?: string };
          };
          const txt = mm.responseData?.translatedText?.trim();
          if (txt && ARABIC_CHAR_RE.test(txt)) {
            return [normalizeArabicCueText(txt)];
          }
        }
      } catch {
        // ignore
      }
    }
    return sanitized;
  }
}

async function translateCuesToArabic(cues: SubtitleCue[]): Promise<SubtitleCue[]> {
  const batches: SubtitleCue[][] = [];
  let currentBatch: SubtitleCue[] = [];
  let currentChars = 0;

  for (const cue of cues) {
    const cleanLine = cue.text.replace(/\s+/g, " ").trim();
    if (
      currentBatch.length > 0 &&
      (currentChars + cleanLine.length > 2200 || currentBatch.length >= 35)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    currentBatch.push(cue);
    currentChars += cleanLine.length + 1;
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  const translatedCues: SubtitleCue[] = [];
  for (let i = 0; i < batches.length; i += 4) {
    const group = batches.slice(i, i + 4);
    const results = await Promise.all(
      group.map(async (batch) => {
        const translatedTexts = await translateLinesToArabic(
          batch.map((c) => c.text)
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

  try {
    const [subCat, openSubs] = await Promise.all([
      fetchFromSubtitleCat(episode),
      fetchFromOpenSubtitles(episode),
    ]);

    const arabicUrlPool = [
      ...(subCat.arUrl ? [subCat.arUrl] : []),
      ...openSubs.arUrls.slice(0, 3),
    ];

    const englishUrlPool = [
      ...(subCat.enUrl ? [subCat.enUrl] : []),
      ...openSubs.enUrls.slice(0, 3),
    ];

    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000",
    };

    // English CC: return ONLY native English subtitles
    if (lang === "en") {
      for (const url of englishUrlPool) {
        const cues = await fetchSubtitleFile(url);
        if (cues && !hasArabicContent(cues)) {
          return NextResponse.json(
            {
              found: true,
              lang: "en",
              source: "native",
              episode,
              count: cues.length,
              cues,
            },
            { headers: cacheHeaders }
          );
        }
      }
      return NextResponse.json({ found: false, cues: [] });
    }

    // Arabic CC — Tier 1: Native Arabic SRT (verified to actually contain Arabic script!)
    for (const url of arabicUrlPool) {
      const cues = await fetchSubtitleFile(url);
      if (cues && hasArabicContent(cues)) {
        return NextResponse.json(
          {
            found: true,
            lang: "ar",
            source: "native",
            episode,
            count: cues.length,
            cues,
          },
          { headers: cacheHeaders }
        );
      }
    }

    // Arabic CC — Tier 2: Translate English SRT line-by-line into verified Arabic
    for (const url of englishUrlPool) {
      const englishCues = await fetchSubtitleFile(url);
      if (englishCues) {
        const arabicCues = await translateCuesToArabic(englishCues);
        if (hasArabicContent(arabicCues)) {
          return NextResponse.json(
            {
              found: true,
              lang: "ar",
              source: "translated",
              episode,
              count: arabicCues.length,
              cues: arabicCues,
            },
            { headers: cacheHeaders }
          );
        }
      }
    }

    return NextResponse.json({ found: false, cues: [] });
  } catch {
    return NextResponse.json({ found: false, cues: [] });
  }
}
