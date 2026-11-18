import type { SubtitleCue } from "@/types/anime";

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

function cleanCueText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "") // strip HTML tags like <i>, <font>
    .replace(/\{\\[^}]+\}/g, "") // strip ASS/SSA override tags
    .replace(/\r/g, "")
    .trim();
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
  // If UTF-8 produced replacement characters, retry with Windows-1256 (common Arabic SRT encoding)
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
