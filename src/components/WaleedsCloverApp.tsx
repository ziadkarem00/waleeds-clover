"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EpisodeFilters } from "@/components/EpisodeFilters";
import { EpisodeGrid } from "@/components/EpisodeGrid";
import { GreetingOverlay } from "@/components/GreetingOverlay";
import { HeroBanner } from "@/components/HeroBanner";
import { Navbar } from "@/components/Navbar";
import { VideoPlayer } from "@/components/VideoPlayer";
import { clampEpisodeNumber, generateFallbackEpisodes } from "@/lib/arcs";
import { loadEpisodes } from "@/lib/jikan";
import {
  DEFAULT_WATCH_STATE,
  loadWatchState,
  saveWatchState,
} from "@/lib/storage";
import type {
  CaptionLanguage,
  Episode,
  ServerId,
  StoryArcId,
  UserWatchState,
} from "@/types/anime";

export function WaleedsCloverApp() {
  // Always show Greeting Page on every visit
  const [showGreeting, setShowGreeting] = useState(true);

  const [episodes, setEpisodes] = useState<Episode[]>(() =>
    generateFallbackEpisodes()
  );
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(true);
  const [dataSource, setDataSource] = useState<"jikan" | "fallback">("jikan");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [watchState, setWatchState] =
    useState<UserWatchState>(DEFAULT_WATCH_STATE);
  const [hydrated, setHydrated] = useState(false);

  const [activeEpisodeNumber, setActiveEpisodeNumber] = useState(1);
  const [selectedArc, setSelectedArc] = useState<StoryArcId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideFiller, setHideFiller] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [lightsOff, setLightsOff] = useState(false);

  const playerSectionRef = useRef<HTMLDivElement | null>(null);
  const gridSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = loadWatchState();
    setWatchState(saved);
    if (saved.lastWatched?.episodeNumber) {
      setActiveEpisodeNumber(saved.lastWatched.episodeNumber);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveWatchState(watchState);
  }, [watchState, hydrated]);

  const fetchMetadata = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingEpisodes(true);
    }

    const result = await loadEpisodes({ forceRefresh });
    setEpisodes(result.episodes);
    setDataSource(result.source);
    setIsLoadingEpisodes(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void fetchMetadata(false);
  }, [fetchMetadata]);

  useEffect(() => {
    document.body.style.overflow = showGreeting ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showGreeting]);

  const watchedSet = useMemo(
    () => new Set(watchState.watchedEpisodes),
    [watchState.watchedEpisodes]
  );
  const favoriteSet = useMemo(
    () => new Set(watchState.favoriteEpisodes),
    [watchState.favoriteEpisodes]
  );

  const activeEpisode = useMemo(() => {
    return (
      episodes.find((ep) => ep.number === activeEpisodeNumber) ?? episodes[0]
    );
  }, [episodes, activeEpisodeNumber]);

  const resumeEpisodeData = useMemo(() => {
    const epNum = watchState.lastWatched?.episodeNumber ?? 1;
    return episodes.find((ep) => ep.number === epNum);
  }, [episodes, watchState.lastWatched]);

  const filteredEpisodes = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();

    return episodes.filter((ep) => {
      if (selectedArc !== "all" && ep.arcId !== selectedArc) return false;
      if (hideFiller && ep.filler) return false;
      if (favoritesOnly && !favoriteSet.has(ep.number)) return false;

      if (trimmed) {
        const matchesNumber =
          String(ep.number) === trimmed ||
          `ep ${ep.number}`.includes(trimmed) ||
          `episode ${ep.number}`.includes(trimmed) ||
          String(ep.number).includes(trimmed);
        const matchesTitle = ep.title.toLowerCase().includes(trimmed);
        const matchesRomaji = ep.titleRomaji.toLowerCase().includes(trimmed);
        if (!matchesNumber && !matchesTitle && !matchesRomaji) return false;
      }

      return true;
    });
  }, [episodes, selectedArc, hideFiller, favoritesOnly, favoriteSet, searchQuery]);

  const scrollToPlayer = useCallback(() => {
    window.requestAnimationFrame(() => {
      playerSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const handleSelectEpisode = useCallback(
    (episodeNumber: number) => {
      const safeNum = clampEpisodeNumber(episodeNumber);
      setActiveEpisodeNumber(safeNum);
      setWatchState((prev) => ({
        ...prev,
        lastWatched: {
          episodeNumber: safeNum,
          updatedAt: new Date().toISOString(),
          status: prev.watchedEpisodes.includes(safeNum)
            ? "completed"
            : "watching",
        },
      }));
      scrollToPlayer();
    },
    [scrollToPlayer]
  );

  const handleToggleWatched = useCallback((episodeNumber: number) => {
    const safeNum = clampEpisodeNumber(episodeNumber);
    setWatchState((prev) => {
      const exists = prev.watchedEpisodes.includes(safeNum);
      const nextWatched = exists
        ? prev.watchedEpisodes.filter((n) => n !== safeNum)
        : [...prev.watchedEpisodes, safeNum].sort((a, b) => a - b);

      const nextLastWatched =
        prev.lastWatched?.episodeNumber === safeNum
          ? {
              ...prev.lastWatched,
              updatedAt: new Date().toISOString(),
              status: exists ? ("watching" as const) : ("completed" as const),
            }
          : prev.lastWatched;

      return {
        ...prev,
        watchedEpisodes: nextWatched,
        lastWatched: nextLastWatched,
      };
    });
  }, []);

  const handleToggleFavorite = useCallback((episodeNumber: number) => {
    const safeNum = clampEpisodeNumber(episodeNumber);
    setWatchState((prev) => {
      const exists = prev.favoriteEpisodes.includes(safeNum);
      const nextFavorites = exists
        ? prev.favoriteEpisodes.filter((n) => n !== safeNum)
        : [...prev.favoriteEpisodes, safeNum].sort((a, b) => a - b);
      return {
        ...prev,
        favoriteEpisodes: nextFavorites,
      };
    });
  }, []);

  const handleSelectServer = useCallback((server: ServerId) => {
    setWatchState((prev) => ({
      ...prev,
      preferredServer: server,
    }));
  }, []);

  const handleSelectCaptionLanguage = useCallback((lang: CaptionLanguage) => {
    setWatchState((prev) => {
      // When selecting Arabic CC, switch to VidPlus if current server lacks Arabic CC
      const needsMultiCC =
        lang === "ar" &&
        prev.preferredServer !== "vidplus" &&
        prev.preferredServer !== "vidlink";

      return {
        ...prev,
        captionLanguage: lang,
        preferredServer: needsMultiCC ? "vidplus" : prev.preferredServer,
      };
    });
  }, []);

  const handleToggleAdShield = useCallback(() => {
    setWatchState((prev) => ({
      ...prev,
      adShieldEnabled: !prev.adShieldEnabled,
    }));
  }, []);

  const handleEnterFromGreeting = useCallback(
    (resumeEp?: number) => {
      setShowGreeting(false);
      if (resumeEp) {
        handleSelectEpisode(resumeEp);
      }
    },
    [handleSelectEpisode]
  );

  const handleShowFavorites = useCallback(() => {
    setFavoritesOnly((prev) => !prev);
    window.requestAnimationFrame(() => {
      gridSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    setSelectedArc("all");
    setSearchQuery("");
    setHideFiller(false);
    setFavoritesOnly(false);
  }, []);

  return (
    <div className="min-h-screen bg-obsidian text-zinc-100">
      <GreetingOverlay
        isOpen={showGreeting}
        onEnter={handleEnterFromGreeting}
        watchedCount={watchState.watchedEpisodes.length}
        lastWatched={watchState.lastWatched}
      />

      {lightsOff && (
        <div
          onClick={() => setLightsOff(false)}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/90 backdrop-blur-sm transition-opacity duration-200"
        />
      )}

      <Navbar
        watchedCount={watchState.watchedEpisodes.length}
        favoritesCount={watchState.favoriteEpisodes.length}
        favoritesOnly={favoritesOnly}
        onShowFavorites={handleShowFavorites}
        onOpenGreeting={() => setShowGreeting(true)}
        onScrollTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <HeroBanner
          watchedCount={watchState.watchedEpisodes.length}
          lastWatched={watchState.lastWatched}
          resumeEpisodeData={resumeEpisodeData}
          onResume={handleSelectEpisode}
        />

        <div ref={playerSectionRef} className="scroll-mt-20">
          {activeEpisode && (
            <VideoPlayer
              episode={activeEpisode}
              activeServer={watchState.preferredServer}
              onSelectServer={handleSelectServer}
              captionLanguage={watchState.captionLanguage}
              onSelectCaptionLanguage={handleSelectCaptionLanguage}
              isWatched={watchedSet.has(activeEpisode.number)}
              isFavorite={favoriteSet.has(activeEpisode.number)}
              onToggleWatched={handleToggleWatched}
              onToggleFavorite={handleToggleFavorite}
              onSelectEpisode={handleSelectEpisode}
              lightsOff={lightsOff}
              onToggleLightsOff={() => setLightsOff((prev) => !prev)}
              adShieldEnabled={watchState.adShieldEnabled}
              onToggleAdShield={handleToggleAdShield}
            />
          )}
        </div>

        <div ref={gridSectionRef} className="scroll-mt-20 space-y-5 pt-2">
          <EpisodeFilters
            selectedArc={selectedArc}
            onSelectArc={setSelectedArc}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            hideFiller={hideFiller}
            onToggleHideFiller={() => setHideFiller((prev) => !prev)}
            favoritesOnly={favoritesOnly}
            onToggleFavoritesOnly={() => setFavoritesOnly((prev) => !prev)}
            totalMatching={filteredEpisodes.length}
            favoritesCount={watchState.favoriteEpisodes.length}
            showSyncButton={!isLoadingEpisodes && dataSource === "fallback"}
            isRefreshing={isRefreshing}
            onRefreshMetadata={() => void fetchMetadata(true)}
          />

          <EpisodeGrid
            episodes={filteredEpisodes}
            activeEpisodeNumber={activeEpisodeNumber}
            watchedSet={watchedSet}
            favoriteSet={favoriteSet}
            isLoading={isLoadingEpisodes}
            onSelectEpisode={handleSelectEpisode}
            onToggleWatched={handleToggleWatched}
            onToggleFavorite={handleToggleFavorite}
            onResetFilters={handleResetFilters}
          />
        </div>
      </main>

      <footer className="mt-14 border-t border-hairline py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-zinc-600 sm:px-6 lg:px-8">
          <span>Waleed&apos;s Clover · Dedicated to Walid</span>
          <span>Black Clover Season 1 (Ep 1–170)</span>
        </div>
      </footer>
    </div>
  );
}
