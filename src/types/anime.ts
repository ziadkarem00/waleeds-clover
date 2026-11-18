export type StoryArcId =
  | "all"
  | "magic-knights-dungeon"
  | "royal-capital-midnight-sun"
  | "seabed-witches-forest"
  | "royal-knights-selection"
  | "elf-reincarnation"
  | "heart-kingdom-spade-raid";

export interface StoryArc {
  id: StoryArcId;
  name: string;
  shortName: string;
  rangeLabel: string;
  startEpisode: number;
  endEpisode: number;
}

export interface Episode {
  number: number;
  title: string;
  titleRomaji: string;
  aired: string | null;
  filler: boolean;
  recap: boolean;
  arcId: Exclude<StoryArcId, "all">;
  arcName: string;
}

export type ServerId =
  | "vidplus"
  | "vidlink"
  | "animeembed-ani"
  | "animeembed-mal"
  | "animeembed-dub";

export type CaptionLanguage = "en" | "ar";

export interface EmbedServer {
  id: ServerId;
  name: string;
  shortLabel: string;
  supportsArabicCC: boolean;
  supportsSandbox: boolean;
  buildUrl: (episodeNumber: number) => string;
}

export interface LastWatchedRecord {
  episodeNumber: number;
  updatedAt: string;
  status: "watching" | "completed";
}

export interface UserWatchState {
  lastWatched: LastWatchedRecord | null;
  watchedEpisodes: number[];
  favoriteEpisodes: number[];
  preferredServer: ServerId;
  captionLanguage: CaptionLanguage;
  adShieldEnabled: boolean;
}

export interface EpisodeCachePayload {
  version: number;
  cachedAt: number;
  source: "jikan" | "fallback";
  episodes: Episode[];
}
