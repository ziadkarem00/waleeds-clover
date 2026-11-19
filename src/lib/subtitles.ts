import type { SubtitleCue } from "@/types/anime";

const ARABIC_CHAR_RE = /[\u0600-\u06FF]/;
const BIDI_CONTROL_RE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

function parseTimestamp(raw: string): number {
  const cleaned = raw.trim().replace(",", ".");
  const parts = cleaned.split(":");
  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);
    if ([hours, minutes, seconds].every(Number.isFinite)) {
      return hours * 3600 + minutes * 60 + seconds;
    }
  } else if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if ([minutes, seconds].every(Number.isFinite)) {
      return minutes * 60 + seconds;
    }
  }
  return NaN;
}

/**
 * Fixes legacy visual-order Arabic SRT punctuation where dots, commas,
 * question marks, exclamation marks, or ellipses were typed at the start
 * of a line for old LTR video players.
 */
export function normalizeArabicLine(line: string): string {
  let text = line.replace(BIDI_CONTROL_RE, "").replace(/\s+/g, " ").trim();
  if (!text || !ARABIC_CHAR_RE.test(text)) return text;

  text = text.replace(/\?/g, "؟").replace(/,(?=\s|$)/g, "،");

  let hasDialogueDash = false;
  if (/^[-–—]\s*/.test(text)) {
    hasDialogueDash = true;
    text = text.replace(/^[-–—]\s*/, "").trim();
  } else if (/\s+[-–—]$/.test(text)) {
    hasDialogueDash = true;
    text = text.replace(/\s+[-–—]$/, "").trim();
  }

  const leadingPunctMatch = text.match(/^([.!؟،,:;…]+)\s*(.+)$/);
  if (leadingPunctMatch) {
    const [, rawLeading, body] = leadingPunctMatch;
    if (body && ARABIC_CHAR_RE.test(body)) {
      const endsWithPunct = /[.!؟،,:;…]$/.test(body);
      if (!endsWithPunct) {
        const fixedEnd =
          rawLeading === "..." || rawLeading === "…"
            ? "..."
            : rawLeading.split("").reverse().join("");
        text = `${body.trim()}${fixedEnd}`;
      }
    }
  }

  text = text.replace(/\s+([.!؟،,:;…])/g, "$1");

  return hasDialogueDash ? `- ${text}` : text;
}

export function normalizeArabicCueText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => normalizeArabicLine(line))
    .filter(Boolean)
    .join("\n");
}

function cleanCueText(raw: string): string {
  const stripped = raw
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\[^}]+\}/g, "")
    .replace(/\r/g, "")
    .trim();

  if (!stripped) return "";
  return normalizeArabicCueText(stripped);
}

export function parseSrtOrVtt(content: string): SubtitleCue[] {
  const normalized = content
    .replace(/^\uFEFF/, "")
    .replace(/^WEBVTT[^\n]*\n+/i, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) continue;

    const timingIdx = lines.findIndex((line) => line.includes("-->"));
    if (timingIdx === -1) continue;

    const timingLine = lines[timingIdx];
    const [startRaw, endAndSettings] = timingLine.split("-->");
    if (!startRaw || !endAndSettings) continue;

    const endRaw = endAndSettings.trim().split(/\s+/)[0] ?? "";
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      continue;
    }

    const text = cleanCueText(lines.slice(timingIdx + 1).join("\n"));
    if (!text) continue;

    cues.push({ start, end, text });
  }

  return cues.sort((a, b) => a.start - b.start);
}

export function decodeSubtitleBuffer(buffer: ArrayBuffer): string {
  const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (utf8Text.includes("\uFFFD")) {
    try {
      return new TextDecoder("windows-1256").decode(buffer);
    } catch {
      return utf8Text;
    }
  }
  return utf8Text;
}

export function findActiveCue(
  cues: SubtitleCue[],
  timeSeconds: number
): SubtitleCue | null {
  if (cues.length === 0 || !Number.isFinite(timeSeconds)) return null;

  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const cue = cues[mid];
    if (timeSeconds < cue.start) {
      high = mid - 1;
    } else if (timeSeconds > cue.end) {
      low = mid + 1;
    } else {
      return cue;
    }
  }

  return null;
}
