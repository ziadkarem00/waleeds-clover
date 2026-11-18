import type { Episode, StoryArc, StoryArcId } from "@/types/anime";

export const TOTAL_EPISODES = 170;
export const ANILIST_ID = 97940;
export const MAL_ID = 34572;

export const STORY_ARCS: StoryArc[] = [
  {
    id: "all",
    name: "All Episodes",
    shortName: "All Episodes",
    rangeLabel: "1–170",
    startEpisode: 1,
    endEpisode: 170,
  },
  {
    id: "magic-knights-dungeon",
    name: "Magic Knights Entrance & Dungeon",
    shortName: "Magic Knights & Dungeon",
    rangeLabel: "1–19",
    startEpisode: 1,
    endEpisode: 19,
  },
  {
    id: "royal-capital-midnight-sun",
    name: "Royal Capital & Eye of the Midnight Sun",
    shortName: "Royal Capital & Midnight Sun",
    rangeLabel: "20–39",
    startEpisode: 20,
    endEpisode: 39,
  },
  {
    id: "seabed-witches-forest",
    name: "Seabed Temple & Witches' Forest",
    shortName: "Seabed & Witches' Forest",
    rangeLabel: "40–65",
    startEpisode: 40,
    endEpisode: 65,
  },
  {
    id: "royal-knights-selection",
    name: "Royal Knights Selection",
    shortName: "Royal Knights Selection",
    rangeLabel: "66–84",
    startEpisode: 66,
    endEpisode: 84,
  },
  {
    id: "elf-reincarnation",
    name: "Elf Reincarnation Arc",
    shortName: "Elf Reincarnation",
    rangeLabel: "85–129",
    startEpisode: 85,
    endEpisode: 129,
  },
  {
    id: "heart-kingdom-spade-raid",
    name: "Heart Kingdom & Spade Raid",
    shortName: "Heart Kingdom & Spade Raid",
    rangeLabel: "130–170",
    startEpisode: 130,
    endEpisode: 170,
  },
];

export const KNOWN_FILLER_EPISODES = new Set<number>([
  13, 29, 66, 68, 82, 102, 123, 124, 125, 130, 131, 132, 133, 134, 135, 136,
  137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151,
  152, 153, 154, 155, 156, 157,
]);

const NOTABLE_FALLBACK_TITLES: Record<number, { en: string; romaji: string }> = {
  1: { en: "Asta and Yuno", romaji: "Asta to Yuno" },
  2: { en: "The Boys' Promise", romaji: "Shounen no Chikai" },
  3: { en: "To the Royal Capital of the Clover Kingdom!", romaji: "Clover Oukoku, Outo e!" },
  4: { en: "The Magic Knights Entrance Exam", romaji: "Mahou Kishidan Nyuudan Shiken" },
  5: { en: "The Path to the Wizard King", romaji: "Mahoutei e no Michi" },
  6: { en: "The Black Bulls", romaji: "Kuro no Bougyuu" },
  14: { en: "Dungeon", romaji: "Makyuu" },
  19: { en: "Destruction and Salvation", romaji: "Houkai to Kyuusai" },
  34: { en: "Light Magic vs. Dark Magic", romaji: "Hikari Mahou vs Yami Mahou" },
  49: { en: "Beyond Limits", romaji: "Genkai no Saki" },
  63: { en: "Not in the Slightest", romaji: "Nandemonai" },
  84: { en: "The Victors", romaji: "Shousha" },
  93: { en: "Julius Novachrono", romaji: "Julius Novachrono" },
  100: { en: "We Won't Lose to You", romaji: "Omae ni wa Makenai" },
  119: { en: "The Final Attack", romaji: "Owari no Ichigeki" },
  158: { en: "The Beginning of Hope and Despair", romaji: "Kibou to Zetsubou no Makuake" },
  167: { en: "Black Oath", romaji: "Kuro no Chikai" },
  170: { en: "The Faraway Future", romaji: "Haruka Mirai" },
};

export function getArcForEpisode(episodeNumber: number): {
  arcId: Exclude<StoryArcId, "all">;
  arcName: string;
} {
  const matched = STORY_ARCS.find(
    (arc) =>
      arc.id !== "all" &&
      episodeNumber >= arc.startEpisode &&
      episodeNumber <= arc.endEpisode
  );

  if (matched && matched.id !== "all") {
    return {
      arcId: matched.id,
      arcName: matched.shortName,
    };
  }

  return {
    arcId: "heart-kingdom-spade-raid",
    arcName: "Heart Kingdom & Spade Raid",
  };
}

export function generateFallbackEpisodes(): Episode[] {
  return Array.from({ length: TOTAL_EPISODES }, (_, index) => {
    const number = index + 1;
    const arc = getArcForEpisode(number);
    const notable = NOTABLE_FALLBACK_TITLES[number];

    return {
      number,
      title: notable?.en ?? `Episode ${number}`,
      titleRomaji: notable?.romaji ?? "",
      aired: null,
      filler: KNOWN_FILLER_EPISODES.has(number),
      recap: number === 29 || number === 66 || number === 123 || number === 124,
      arcId: arc.arcId,
      arcName: arc.arcName,
    };
  });
}

export function clampEpisodeNumber(ep: number): number {
  if (!Number.isFinite(ep)) return 1;
  return Math.min(TOTAL_EPISODES, Math.max(1, Math.floor(ep)));
}
