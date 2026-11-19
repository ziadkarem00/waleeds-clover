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

export type ServerId = "animeembed-ani" | "animeembed-mal" | "animeembed-dub";

export type CaptionMode = "en" | "ar" | "off";

export type SubtitleSize = "sm" | "md" | "lg" | "xl";
export type SubtitleBackground = "none" | "subtle" | "box";
export type SubtitleColor = "white" | "yellow";
export type SubtitlePosition = "low" | "standard" | "high";

export interface SubtitleSettings {
  size: SubtitleSize;
  background: SubtitleBackground;
  color: SubtitleColor;
  position: SubtitlePosition;
}

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export interface EmbedServer {
  id: ServerId;
  name: string;
  shortLabel: string;
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
  captionMode: CaptionMode;
  subtitleSettings: SubtitleSettings;
}

export interface EpisodeCachePayload {
  version: number;
  cachedAt: number;
  source: "jikan" | "fallback";
  episodes: Episode[];
}
