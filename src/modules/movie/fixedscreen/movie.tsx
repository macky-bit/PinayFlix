import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { supabase } from "../../../lib/supabase"

import { recordWatchProgress } from "../watchHistory"

import {
  COMMENT_MAX_LENGTH,
  deleteContentComment,
  loadEngagement,
  postContentComment,
  resolveContentId,
  saveReaction,
  updateContentComment,
  optimisticReaction,
  type ContentComment,
} from "../engagement"

import { fetchTVEpisodes, type TMDBEpisode } from "../tmdb"

import { loadSoundtracks, type SoundtrackTrack } from "../soundtrack"

import { loadTrackLyrics, type TrackLyricsResult } from "../lyrics"

import { loadSubtitleTrack, type SubtitleCue } from "../subtitles"

import { useSubtitleSize } from "../../settings/subtitlePreferences"

import { loadWikipediaRefresher, type WikipediaRefresher } from "../refresher"

import { createRefresherVideoUrl } from "../refresherVideo"

import {
  PLAYBACK_QUALITIES,
  PLAYBACK_SOURCE_BY_QUALITY,
  playbackQualitiesForPlan,
  preferredPlaybackQuality,
  requiredPlanForQuality,
  type PlaybackQuality,
} from "../playbackQuality"

import {
  createEmptyReactionCounts,
  REACTION_DEFINITIONS,
  type ReactionKey,
} from "../../../shared/reactions"

import styles from "./movie.module.css"

interface WatchProps {
  id: number

  title: string

  year: string

  rating: string

  match: number

  backgroundImage: string

  isSeries?: boolean

  activeProfile?: {
    id: number

    name: string

    avatar: string
  } | null

  onProgress?: (progress: number) => void

  onBack: () => void
}

type ActivePanel = "music" | "refresher" | "comments" | "episodes" | null

type LyricsLookupState = { status: "loading" } | {
  status: "ready"

  result: TrackLyricsResult
} | { status: "not-found" } | { status: "error" }

type RefresherLookupState = { status: "idle" } | { status: "loading" } | {
  status: "ready"
  result: WikipediaRefresher
} | { status: "error" message: string }

const MOVIE_FALLBACK_SECONDS = 2 * 60 * 60

const REFRESHER_SKIP_DELAY_SECONDS = 5

function loadProgress(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("sf_progress") || "{}",
    )

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {}

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isFinite(entry[1]),
      ),
    )
  } catch {
    return {}
  }
}

function saveProgress(progress: Record<string, number>) {
  try {
    localStorage.setItem("sf_progress", JSON.stringify(progress))
  } catch {
    // Playback should continue when storage is unavailable or full.
  }
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))

  const hours = Math.floor(safe / 3600)

  const minutes = Math.floor((safe % 3600) / 60)

  const secs = safe % 60

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`
}

function durationSeconds(duration: string) {
  const minutes = Number.parseInt(duration, 10)

  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : 45 * 60
}

function initialsFor(name: string) {
  return (
    name

      .trim()

      .split(/\s+/)

      .map((part) => part[0])

      .join("")

      .slice(0, 2)

      .toUpperCase() || "SF"
  )
}

function PlayerIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <span aria-hidden="true">❚❚</span>
  ) : (
    <span aria-hidden="true">▶</span>
  )
}

function MusicIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  )
}

function TrackPlayIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="7,4 20,12 7,20" />
    </svg>
  )
}

function TrackPauseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

function LyricsIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.38.33.72.6 1 .3.28.68.42 1.1.4h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <polyline points="20 4 20 11 13 11" />
    </svg>
  )
}

function CommentsIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M5 5h14v11H9l-4 3V5Z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  )
}

function EpisodesIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="m10 9 5 3-5 3V9Z" />
    </svg>
  )
}

function ExpandIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      {active ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      )}
    </svg>
  )
}

function RefresherSection({ title, items }: { title: string items: string[] }) {
  return (
    <div className={styles.refresherSection}>
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export default function WatchScreen({
  id,

  title,

  year,

  rating,

  match,

  backgroundImage,

  isSeries = false,

  activeProfile = null,

  onProgress,

  onBack,
}: WatchProps) {
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([])

  const [selectedEpisode, setSelectedEpisode] = useState<TMDBEpisode | null>(
    null,
  )

  const [episodesLoading, setEpisodesLoading] = useState(false)

  const [episodesError, setEpisodesError] = useState(false)

  const [playing, setPlaying] = useState(false)

  const [showControls, setShowControls] = useState(true)

  const [volume, setVolume] = useState(80)

  const [muted, setMuted] = useState(false)

  const [captions, setCaptions] = useState(false)

  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[] | null>(null)

  const [subtitleLoading, setSubtitleLoading] = useState(false)

  const [subtitleError, setSubtitleError] = useState(false)

  const subtitleSize = useSubtitleSize()

  const [settingsOpen, setSettingsOpen] = useState(false)

  const [subscriptionPlan, setSubscriptionPlan] = useState<string>("Basic")

  const [subscriptionLoading, setSubscriptionLoading] = useState(true)

  const [selectedQuality, setSelectedQuality] = useState<PlaybackQuality>(480)

  const [clipStarted, setClipStarted] = useState(false)

  const [clipEnded, setClipEnded] = useState(false)

  const [videoError, setVideoError] = useState<string | null>(null)

  const [activePanel, setActivePanel] = useState<ActivePanel>(null)

  const [isFullscreen, setIsFullscreen] = useState(false)

  const [spoilersRevealed, setSpoilersRevealed] = useState(false)

  const [refresherState, setRefresherState] = useState<RefresherLookupState>({
    status: "idle",
  })

  const [refresherVideoUrl, setRefresherVideoUrl] = useState("")

  const [refresherVideoLoading, setRefresherVideoLoading] = useState(false)

  const [refresherVideoPlaying, setRefresherVideoPlaying] = useState(false)

  const [refresherSkipSeconds, setRefresherSkipSeconds] = useState(
    REFRESHER_SKIP_DELAY_SECONDS,
  )

  const [refresherVideoError, setRefresherVideoError] = useState<string | null>(
    null,
  )

  const [progress, setProgress] = useState<Record<string, number>>(loadProgress)

  const [myReaction, setMyReaction] = useState<ReactionKey | null>(null)

  const [reactionCounts, setReactionCounts] =
    useState<Record<ReactionKey, number>>(createEmptyReactionCounts)

  const [internalContentId, setInternalContentId] = useState<number | null>(
    null,
  )

  const [engagementUserId, setEngagementUserId] = useState<string | null>(null)

  const [engagementLoading, setEngagementLoading] = useState(true)

  const [engagementError, setEngagementError] = useState<string | null>(null)

  const [reactionPending, setReactionPending] = useState(false)

  const [comments, setComments] = useState<ContentComment[]>([])

  const [commentDraft, setCommentDraft] = useState("")

  const [commentPending, setCommentPending] = useState(false)

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)

  const [editingCommentText, setEditingCommentText] = useState("")

  const [commentActionPending, setCommentActionPending] =
    useState<string | null>(null)

  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null)

  const [soundtracks, setSoundtracks] = useState<SoundtrackTrack[]>([])

  const [soundtracksLoading, setSoundtracksLoading] = useState(true)

  const [soundtracksError, setSoundtracksError] = useState<string | null>(null)

  const [lyricsTrackId, setLyricsTrackId] = useState<string | null>(null)

  const [activeSoundtrackId, setActiveSoundtrackId] = useState<string | null>(
    null,
  )

  const [soundtrackPlaying, setSoundtrackPlaying] = useState(false)

  const [soundtrackPlaybackError, setSoundtrackPlaybackError] =
    useState<string | null>(null)

  const [lyricsLookups, setLyricsLookups] =
    useState<Record<string, LyricsLookupState>>({})

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const engagementRequest = useRef(0)

  const watchHistorySyncRef = useRef<{
    contentId: number

    playbackSeconds: number
  } | null>(null)

  const pageRef = useRef<HTMLDivElement>(null)

  const panelCloseRef = useRef<HTMLButtonElement>(null)

  const playerVideoRef = useRef<HTMLVideoElement>(null)

  const soundtrackAudioRef = useRef<HTMLAudioElement>(null)

  const pendingVideoTimeRef = useRef(0)

  const lyricsRequestRef = useRef<AbortController | null>(null)

  const lyricsRequestVersion = useRef(0)

  const refresherRequestVersion = useRef(0)

  useEffect(() => {
    if (!refresherVideoPlaying) {
      setRefresherSkipSeconds(REFRESHER_SKIP_DELAY_SECONDS)

      return
    }

    if (!clipStarted || refresherSkipSeconds === 0) return

    const timer = window.setTimeout(() => {
      setRefresherSkipSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [clipStarted, refresherSkipSeconds, refresherVideoPlaying])

  useEffect(() => {
    let active = true

    setPlaying(false)

    setClipStarted(false)

    setClipEnded(false)

    setVideoError(null)

    setSettingsOpen(false)

    setSelectedEpisode(null)

    setEpisodes([])

    setEpisodesError(false)

    setActivePanel(null)

    setSpoilersRevealed(false)

    if (!isSeries)
      return () => {
        active = false
      }

    setEpisodesLoading(true)

    fetchTVEpisodes(id)

      .then((items) => {
        if (!active) return

        setEpisodes(items)

        setSelectedEpisode(items[0] ?? null)

        setEpisodesError(items.length === 0)
      })

      .catch(() => {
        if (active) setEpisodesError(true)
      })

      .finally(() => {
        if (active) setEpisodesLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, isSeries])

  useEffect(() => {
    let active = true

    setSubscriptionLoading(true)

    void supabase

      .rpc("get_my_subscription_state")

      .then(({ data, error }) => {
        if (!active) return

        const row = Array.isArray(data) ? data[0] : data

        const planName =
          !error &&
          row &&
          typeof row === "object" &&
          (row as { is_active?: unknown }).is_active
            ? String((row as { plan_name?: unknown }).plan_name ?? "Basic")
            : "Basic"

        setSubscriptionPlan(planName)

        pendingVideoTimeRef.current = playerVideoRef.current?.currentTime ?? 0

        setSelectedQuality(preferredPlaybackQuality(planName))
      })

      .finally(() => {
        if (active) setSubscriptionLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const contentId =
    isSeries && selectedEpisode
      ? `tv-${id}-episode-${selectedEpisode.ep}`
      : `movie-${id}`

  const duration =
    isSeries && selectedEpisode
      ? durationSeconds(selectedEpisode.duration)
      : MOVIE_FALLBACK_SECONDS

  const current = progress[contentId] ?? 0

  const activeSubtitle = subtitleCues?.find(
    (cue) => current >= cue.start && current < cue.end,
  )

  const percent = duration > 0 ? Math.min((current / duration) * 100, 100) : 0

  const watched = percent >= 95

  const playerImage = selectedEpisode?.thumb || backgroundImage

  const contentLabel =
    isSeries && selectedEpisode
      ? `${title} — Episode ${selectedEpisode.ep}: ${selectedEpisode.title}`
      : title

  const allowedQualities = useMemo(
    () => playbackQualitiesForPlan(subscriptionPlan),

    [subscriptionPlan],
  )

  const videoSource = PLAYBACK_SOURCE_BY_QUALITY[selectedQuality]

  const activeVideoSource =
    refresherVideoPlaying && refresherVideoUrl ? refresherVideoUrl : videoSource

  useEffect(() => {
    let active = true

    setSubtitleLoading(true)

    setSubtitleError(false)

    setSubtitleCues(null)

    setCaptions(false)

    void loadSubtitleTrack(supabase, id, isSeries)

      .then((cues) => {
        if (!active) return

        setSubtitleCues(cues)

        setSubtitleLoading(false)
      })

      .catch((reason: unknown) => {
        if (!active) return

        console.error("Unable to load title subtitles", reason)

        setSubtitleError(true)

        setSubtitleLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, isSeries])

  useEffect(() => {
    const video = playerVideoRef.current

    setPlaying(false)

    setClipStarted(false)

    setClipEnded(false)

    setVideoError(null)

    setRefresherVideoUrl("")

    setRefresherVideoLoading(false)

    setRefresherVideoPlaying(false)

    setRefresherVideoError(null)

    setSettingsOpen(false)

    pendingVideoTimeRef.current = 0

    if (!video) return

    video.pause()

    video.currentTime = 0

    video.load()
  }, [contentId])

  useEffect(() => {
    const video = playerVideoRef.current

    if (!video) return

    video.volume = volume / 100

    video.muted = muted
  }, [muted, volume])

  useEffect(() => {
    const video = playerVideoRef.current

    if (!video || clipEnded) return

    if (!playing) {
      video.pause()

      return
    }

    void video.play().catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return

      setPlaying(false)

      setShowControls(true)

      setVideoError("Playback could not start. Select Play to try again.")
    })
  }, [
    clipEnded,

    playing,

    selectedQuality,

    refresherVideoPlaying,

    refresherVideoUrl,
  ])

  useEffect(() => {
    const requestId = ++engagementRequest.current

    setInternalContentId(null)

    setEngagementUserId(null)

    setReactionCounts(createEmptyReactionCounts())

    setMyReaction(null)

    setComments([])

    setCommentDraft("")

    setEditingCommentId(null)

    setEditingCommentText("")

    setCommentActionPending(null)

    setDeleteCommentId(null)

    setReactionPending(false)

    setCommentPending(false)

    setEngagementError(null)

    setEngagementLoading(true)

    void resolveContentId(supabase, id, isSeries)

      .then(async (resolvedId) => {
        if (requestId !== engagementRequest.current) return

        setInternalContentId(resolvedId)

        if (resolvedId === null) {
          throw new Error(
            "Community engagement is not available for this title yet.",
          )
        }

        const snapshot = await loadEngagement(supabase, resolvedId)

        if (requestId !== engagementRequest.current) return

        setEngagementUserId(snapshot.userId)

        setReactionCounts(snapshot.counts)

        setMyReaction(snapshot.myReaction)

        setComments(snapshot.comments)

        setEngagementError(snapshot.warning)
      })

      .catch((reason: unknown) => {
        if (requestId !== engagementRequest.current) return

        setEngagementError(
          reason instanceof Error
            ? reason.message
            : "Unable to load community activity.",
        )
      })

      .finally(() => {
        if (requestId === engagementRequest.current) setEngagementLoading(false)
      })
  }, [id, isSeries, selectedEpisode?.ep])

  useEffect(() => {
    let active = true

    setLyricsTrackId(null)

    const soundtrackAudio = soundtrackAudioRef.current

    soundtrackAudio?.pause()

    if (soundtrackAudio) {
      soundtrackAudio.removeAttribute("src")

      soundtrackAudio.load()
    }

    setActiveSoundtrackId(null)

    setSoundtrackPlaying(false)

    setSoundtrackPlaybackError(null)

    setLyricsLookups({})

    lyricsRequestVersion.current += 1

    lyricsRequestRef.current?.abort()

    lyricsRequestRef.current = null

    setSoundtracksError(null)

    if (internalContentId === null) {
      setSoundtracks([])

      setSoundtracksLoading(false)

      return () => {
        active = false
      }
    }

    setSoundtracksLoading(true)

    void loadSoundtracks(supabase, internalContentId)

      .then((items) => {
        if (active) setSoundtracks(items)
      })

      .catch((reason: unknown) => {
        if (!active) return

        setSoundtracks([])

        setSoundtracksError(
          reason instanceof Error
            ? reason.message
            : "Unable to load this soundtrack.",
        )
      })

      .finally(() => {
        if (active) setSoundtracksLoading(false)
      })

    return () => {
      active = false

      lyricsRequestRef.current?.abort()
    }
  }, [internalContentId])

  useEffect(() => {
    if (activePanel === "music") return

    soundtrackAudioRef.current?.pause()
  }, [activePanel])

  const loadRefresher = useCallback(async () => {
    const requestVersion = ++refresherRequestVersion.current

    setSpoilersRevealed(false)

    if (internalContentId === null) {
      setRefresherState({
        status: "error",

        message: "This title is not connected to the StreamFlix catalog.",
      })

      return
    }

    setRefresherState({ status: "loading" })

    try {
      const result = await loadWikipediaRefresher(
        supabase,

        internalContentId,
      )

      if (requestVersion !== refresherRequestVersion.current) return

      setRefresherState({ status: "ready", result })
    } catch (reason) {
      if (requestVersion !== refresherRequestVersion.current) return

      setRefresherState({
        status: "error",

        message:
          reason instanceof Error
            ? reason.message
            : "Unable to load the Wikipedia refresher.",
      })
    }
  }, [internalContentId])

  useEffect(() => {
    if (activePanel === "refresher") {
      void loadRefresher()

      return
    }

    refresherRequestVersion.current += 1

    setRefresherState({ status: "idle" })

    setSpoilersRevealed(false)
  }, [activePanel, loadRefresher, selectedEpisode?.ep])

  useEffect(() => {
    if (!playing || refresherVideoPlaying) return

    const timer = window.setInterval(() => {
      setProgress((previous) => {
        const previousTime = previous[contentId] ?? 0

        if (previousTime >= duration) return previous

        const next = {
          ...previous,

          [contentId]: Math.min(previousTime + 1, duration),
        }

        saveProgress(next)

        return next
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [contentId, duration, playing, refresherVideoPlaying])

  useEffect(() => {
    if (
      !playing ||
      refresherVideoPlaying ||
      internalContentId === null ||
      current <= 0
    )
      return

    const playbackSeconds = Math.floor(current)

    const previousSync = watchHistorySyncRef.current

    const shouldSync =
      previousSync === null ||
      previousSync.contentId !== internalContentId ||
      Math.abs(playbackSeconds - previousSync.playbackSeconds) >= 15

    if (!shouldSync) return

    const syncPoint = { contentId: internalContentId, playbackSeconds }

    watchHistorySyncRef.current = syncPoint

    onProgress?.(
      Math.max(
        1,
        Math.min(100, Math.round((playbackSeconds / duration) * 100)),
      ),
    )

    void recordWatchProgress(
      supabase,

      internalContentId,

      playbackSeconds,

      activeProfile?.id ?? 0,
    ).catch((error: unknown) => {
      if (watchHistorySyncRef.current === syncPoint) {
        watchHistorySyncRef.current = null
      }

      console.error("Unable to record watch history", error)
    })
  }, [
    current,

    duration,

    internalContentId,

    onProgress,

    playing,

    refresherVideoPlaying,
  ])

  useEffect(() => {
    if (!refresherVideoPlaying && playing && current >= duration)
      setPlaying(false)
  }, [current, duration, playing, refresherVideoPlaying])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === pageRef.current)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!activePanel && !settingsOpen) return

    if (activePanel) panelCloseRef.current?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.fullscreenElement === null) {
        setActivePanel(null)

        setSettingsOpen(false)
      }
    }

    window.addEventListener("keydown", handleEscape)

    return () => window.removeEventListener("keydown", handleEscape)
  }, [activePanel, settingsOpen])

  useEffect(() => {
    if (!deleteCommentId) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && commentActionPending !== deleteCommentId) {
        setDeleteCommentId(null)
      }
    }

    window.addEventListener("keydown", handleEscape)

    return () => window.removeEventListener("keydown", handleEscape)
  }, [commentActionPending, deleteCommentId])

  useEffect(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current)

    if (!playing || activePanel || settingsOpen) {
      setShowControls(true)

      return
    }

    controlsTimer.current = setTimeout(() => {
      setShowControls(false)

      controlsTimer.current = null
    }, 3000)

    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current)
    }
  }, [activePanel, playing, settingsOpen])

  const totalReactions = useMemo(
    () =>
      Object.values(reactionCounts).reduce(
        (total, count) => total + count,

        0,
      ),

    [reactionCounts],
  )

  const seekTo = (seconds: number) => {
    const nextTime = Math.max(0, Math.min(seconds, duration))

    setProgress((previous) => {
      const next = { ...previous, [contentId]: nextTime }

      saveProgress(next)

      return next
    })
  }

  const revealControls = () => {
    setShowControls(true)

    if (controlsTimer.current) clearTimeout(controlsTimer.current)

    if (playing && !activePanel && !settingsOpen)
      controlsTimer.current = setTimeout(() => setShowControls(false), 3000)
  }

  const changeQuality = (quality: PlaybackQuality) => {
    if (!allowedQualities.includes(quality) || quality === selectedQuality)
      return

    pendingVideoTimeRef.current = playerVideoRef.current?.currentTime ?? 0

    setSelectedQuality(quality)

    setVideoError(null)
  }

  const selectEpisode = (episode: TMDBEpisode) => {
    setSelectedEpisode(episode)

    setPlaying(false)

    setClipEnded(false)

    setVideoError(null)

    pendingVideoTimeRef.current = 0

    setShowControls(true)

    setActivePanel(null)

    setSpoilersRevealed(false)
  }

  const togglePanel = (panel: Exclude<ActivePanel, null>) => {
    setActivePanel((currentPanel) => (currentPanel === panel ? null : panel))

    setShowControls(true)

    setSpoilersRevealed(false)
  }

  const finishRefresherVideo = useCallback((notice?: string) => {
    const video = playerVideoRef.current

    video?.pause()

    if (video) video.currentTime = 0

    pendingVideoTimeRef.current = 0

    setRefresherVideoPlaying(false)

    setRefresherVideoUrl("")

    setRefresherVideoLoading(false)

    setClipStarted(false)

    setClipEnded(false)

    setSettingsOpen(false)

    setActivePanel(null)

    setShowControls(true)

    setPlaying(true)

    setVideoError(notice ?? null)
  }, [])

  const startRefresherVideo = async () => {
    if (refresherVideoLoading || refresherVideoPlaying) return

    setRefresherVideoLoading(true)

    setRefresherVideoError(null)

    try {
      const signedUrl = await createRefresherVideoUrl(supabase)

      const video = playerVideoRef.current

      video?.pause()

      if (video) video.currentTime = 0

      pendingVideoTimeRef.current = 0

      setRefresherVideoUrl(signedUrl)

      setRefresherVideoPlaying(true)

      setRefresherVideoLoading(false)

      setClipStarted(false)

      setClipEnded(false)

      setVideoError(null)

      setSettingsOpen(false)

      setActivePanel(null)

      setShowControls(true)

      setPlaying(true)
    } catch (reason) {
      setRefresherVideoLoading(false)

      setRefresherVideoError(
        reason instanceof Error
          ? reason.message
          : "The refresher video could not be loaded.",
      )
    }
  }

  const toggleLyrics = (track: SoundtrackTrack) => {
    if (lyricsTrackId === track.id) {
      setLyricsTrackId(null)

      return
    }

    setLyricsTrackId(track.id)

    const previousLookup = lyricsLookups[track.id]

    if (
      track.lyrics ||
      track.instrumental ||
      previousLookup?.status === "loading" ||
      previousLookup?.status === "ready" ||
      previousLookup?.status === "not-found"
    )
      return

    const controller = new AbortController()

    const requestVersion = lyricsRequestVersion.current

    lyricsRequestRef.current = controller

    setLyricsLookups((current) => ({
      ...current,

      [track.id]: { status: "loading" },
    }))

    void loadTrackLyrics(track.lookupTitle, track.artist, controller.signal)

      .then((result) => {
        if (
          controller.signal.aborted ||
          requestVersion !== lyricsRequestVersion.current
        )
          return

        setLyricsLookups((current) => ({
          ...current,

          [track.id]: result
            ? { status: "ready", result }
            : { status: "not-found" },
        }))
      })

      .catch(() => {
        if (
          controller.signal.aborted ||
          requestVersion !== lyricsRequestVersion.current
        )
          return

        setLyricsLookups((current) => ({
          ...current,

          [track.id]: { status: "error" },
        }))
      })
  }

  const toggleSoundtrackPlayback = async (track: SoundtrackTrack) => {
    const audio = soundtrackAudioRef.current

    if (!audio) return

    setSoundtrackPlaybackError(null)

    if (!track.audioUrl) {
      setSoundtrackPlaybackError(
        `No playable audio file is stored for “${track.title}”.`,
      )

      return
    }

    if (activeSoundtrackId === track.id && !audio.paused) {
      audio.pause()

      return
    }

    if (activeSoundtrackId !== track.id) {
      audio.pause()

      audio.src = track.audioUrl

      audio.currentTime = 0

      setActiveSoundtrackId(track.id)
    } else if (audio.ended || audio.error) {
      audio.src = track.audioUrl

      audio.currentTime = 0

      audio.load()
    }

    playerVideoRef.current?.pause()

    setPlaying(false)

    try {
      await audio.play()
    } catch (reason: unknown) {
      setSoundtrackPlaying(false)

      setSoundtrackPlaybackError(
        reason instanceof Error
          ? reason.message
          : `Unable to play “${track.title}”.`,
      )
    }
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await pageRef.current?.requestFullscreen()
    } catch {
      setEngagementError(
        "Fullscreen is unavailable in this browser or preview.",
      )
    }
  }

  const react = async (key: ReactionKey) => {
    if (reactionPending || internalContentId === null) return

    const requestId = engagementRequest.current

    const previousReaction = myReaction

    const previousCounts = reactionCounts

    const nextReaction = previousReaction === key ? null : key

    const optimistic = optimisticReaction(
      previousCounts,

      previousReaction,

      nextReaction,
    )

    setReactionCounts(optimistic.counts)

    setMyReaction(optimistic.myReaction)

    setReactionPending(true)

    setEngagementError(null)

    try {
      await saveReaction(
        supabase,

        internalContentId,

        engagementUserId,

        previousReaction,

        nextReaction,
      )
    } catch (reason) {
      if (requestId !== engagementRequest.current) return

      setReactionCounts(previousCounts)

      setMyReaction(previousReaction)

      setEngagementError(
        reason instanceof Error
          ? reason.message
          : "Unable to save your reaction.",
      )
    } finally {
      if (requestId === engagementRequest.current) setReactionPending(false)
    }
  }

  const submitComment = async () => {
    if (commentPending || internalContentId === null) return

    const requestId = engagementRequest.current

    setCommentPending(true)

    setEngagementError(null)

    try {
      const created = await postContentComment(
        supabase,

        internalContentId,

        engagementUserId,

        commentDraft,

        activeProfile
          ? {
              profileId: activeProfile.id,

              name: activeProfile.name,

              avatarUrl: activeProfile.avatar,
            }
          : null,
      )

      if (requestId === engagementRequest.current) {
        setComments((currentComments) => [created, ...currentComments])

        setCommentDraft("")
      }
    } catch (reason) {
      if (requestId !== engagementRequest.current) return

      setEngagementError(
        reason instanceof Error
          ? reason.message
          : "Unable to post your comment.",
      )
    } finally {
      if (requestId === engagementRequest.current) setCommentPending(false)
    }
  }

  const saveCommentEdit = async (commentId: string) => {
    if (commentActionPending) return

    setCommentActionPending(commentId)

    setEngagementError(null)

    try {
      const updated = await updateContentComment(
        supabase,

        commentId,

        engagementUserId,

        editingCommentText,
      )

      setComments((currentComments) =>
        currentComments.map((comment) =>
          comment.id === commentId
            ? {
                ...updated,

                memberProfileId: comment.memberProfileId,

                authorName: comment.authorName,

                authorAvatarUrl: comment.authorAvatarUrl,
              }
            : comment,
        ),
      )

      setEditingCommentId(null)

      setEditingCommentText("")
    } catch (reason) {
      setEngagementError(
        reason instanceof Error
          ? reason.message
          : "Unable to update your comment.",
      )
    } finally {
      setCommentActionPending(null)
    }
  }

  const removeOwnComment = async (commentId: string) => {
    if (commentActionPending) return

    setCommentActionPending(commentId)

    setEngagementError(null)

    try {
      await deleteContentComment(supabase, commentId, engagementUserId)

      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== commentId),
      )

      if (editingCommentId === commentId) {
        setEditingCommentId(null)

        setEditingCommentText("")
      }
    } catch (reason) {
      setEngagementError(
        reason instanceof Error
          ? reason.message
          : "Unable to delete your comment.",
      )
    } finally {
      setCommentActionPending(null)
    }
  }

  const confirmCommentDeletion = async () => {
    if (!deleteCommentId) return

    const commentId = deleteCommentId

    await removeOwnComment(commentId)

    setDeleteCommentId(null)
  }

  const lyricsTrack =
    soundtracks.find((track) => track.id === lyricsTrackId) ?? null

  const activeSoundtrack =
    soundtracks.find((track) => track.id === activeSoundtrackId) ?? null

  const lyricsLookup = lyricsTrack ? lyricsLookups[lyricsTrack.id] : undefined

  const playerUiVisible =
    showControls || !playing || Boolean(activePanel) || settingsOpen

  return (
    <div className={styles.page} ref={pageRef}>
      <audio
        ref={soundtrackAudioRef}
        preload="metadata"
        onPlay={() => setSoundtrackPlaying(true)}
        onPause={() => setSoundtrackPlaying(false)}
        onEnded={() => setSoundtrackPlaying(false)}
        onError={() => {
          if (!activeSoundtrack) return

          setSoundtrackPlaying(false)

          setSoundtrackPlaybackError(
            `Unable to play “${activeSoundtrack.title}”. Check its direct audio URL in the soundtrack database record.`,
          )
        }}
      />
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
            aria-label="Back"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <span className={styles.logo} aria-label="StreamFlix">
            <img src="/favicon.png" alt="" aria-hidden="true" />
            <span>STREAMFLIX</span>
          </span>
          <span className={styles.navSpacer} aria-hidden="true" />
        </div>
      </nav>

      <main
        className={styles.main}
        onMouseMove={revealControls}
        onMouseLeave={() =>
          playing && !activePanel && !settingsOpen && setShowControls(false)
        }
      >
        <section
          className={`${styles.player} ${
            showControls || activePanel ? "" : styles.hideCursor
          }`}
          onClick={() => {
            if (!refresherVideoPlaying) setPlaying((value) => !value)
          }}
          tabIndex={0}
          aria-label={`${contentLabel} player`}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return

            if (
              !refresherVideoPlaying &&
              (event.key === " " || event.key === "Enter")
            ) {
              event.preventDefault()

              setPlaying((value) => !value)
            }
          }}
        >
          {playerImage ? (
            <img src={playerImage} alt="" className={styles.playerImage} />
          ) : (
            <div className={styles.playerFallback}>🎬</div>
          )}
          <video
            ref={playerVideoRef}
            className={`${styles.playerVideo} ${
              styles[
                (`subtitleSize${subtitleSize.replace(/\s/g, "")}` as keyof typeof styles)
              ]
            } ${!clipStarted || clipEnded ? styles.playerVideoHidden : ""}`}
            src={activeVideoSource}
            playsInline
            preload="metadata"
            onPlay={() => {
              setClipStarted(true)

              soundtrackAudioRef.current?.pause()
            }}
            onLoadedMetadata={(event) => {
              const resumeAt = refresherVideoPlaying
                ? 0
                : Math.min(
                    pendingVideoTimeRef.current,

                    event.currentTarget.duration || 0,
                  )

              if (resumeAt > 0) event.currentTarget.currentTime = resumeAt

              pendingVideoTimeRef.current = 0
            }}
            onEnded={() => {
              if (refresherVideoPlaying) {
                finishRefresherVideo()

                return
              }

              setClipEnded(true)

              setPlaying(true)

              setVideoError(null)
            }}
            onError={() => {
              if (refresherVideoPlaying) {
                finishRefresherVideo(
                  `The refresher video could not be played. The ${selectedQuality}p studio presentation has started.`,
                )

                return
              }

              setClipEnded(true)

              setVideoError(
                `${selectedQuality}p video is unavailable. Playback will continue with the title image.`,
              )
            }}
            aria-label={
              refresherVideoPlaying
                ? `${contentLabel} refresher video`
                : `${contentLabel} studio presentation at ${selectedQuality}p`
            }
          />
          <div className={styles.playerGradient} />
          {captions && activeSubtitle && !refresherVideoPlaying && (
            <p
              className={`${styles.subtitleOverlay} ${
                styles[
                  (`subtitleSize${subtitleSize.replace(/\s/g, "")}` as keyof typeof styles)
                ]
              }`}
            >
              {activeSubtitle.text}
            </p>
          )}
          {refresherVideoPlaying && (
            <button
              type="button"
              className={styles.skipRefresherButton}
              disabled={refresherSkipSeconds > 0}
              aria-label={
                refresherSkipSeconds > 0
                  ? `Skip refresher available in ${refresherSkipSeconds} seconds`
                  : "Skip refresher"
              }
              onClick={(event) => {
                event.stopPropagation()

                finishRefresherVideo()
              }}
            >
              {refresherSkipSeconds > 0 && (
                <span
                  className={styles.skipRefresherCountdown}
                  aria-live="polite"
                >
                  Skip in {refresherSkipSeconds}
                </span>
              )}
              <span className={styles.skipRefresherLabel}>Skip Refresher</span>
            </button>
          )}
          {videoError && (
            <p className={styles.videoNotice} role="status">
              {videoError}
            </p>
          )}
          {current > 30 && !playing && !refresherVideoPlaying && (
            <span className={styles.continueBadge}>
              {watched ? "✓ Watched" : `Continue from ${formatTime(current)}`}
            </span>
          )}

          {!refresherVideoPlaying && (
            <div
              className={`${styles.controls} ${
                showControls || activePanel || settingsOpen
                  ? styles.controlsVisible
                  : ""
              }`}
              aria-hidden={!showControls && !activePanel && !settingsOpen}
            >
              <div className={styles.centerControls}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()

                    seekTo(current - 10)
                  }}
                >
                  −10
                </button>
                <button
                  type="button"
                  className={styles.playButton}
                  aria-label={playing ? "Pause" : "Play"}
                  onClick={(event) => {
                    event.stopPropagation()

                    setPlaying((value) => !value)
                  }}
                >
                  <PlayerIcon playing={playing} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()

                    seekTo(current + 10)
                  }}
                >
                  +10
                </button>
              </div>

              <div
                className={styles.bottomControls}
                onClick={(event) => event.stopPropagation()}
              >
                <div className={styles.scrubber}>
                  <span
                    className={styles.scrubberFill}
                    style={{ width: `${percent}%` }}
                  />
                  <span
                    className={styles.scrubberThumb}
                    style={{ left: `${percent}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    step="1"
                    value={current}
                    aria-label="Playback position"
                    aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
                    onChange={(event) => seekTo(Number(event.target.value))}
                  />
                </div>
                <div className={styles.controlRow}>
                  <div className={styles.controlGroup}>
                    <button
                      type="button"
                      aria-label={playing ? "Pause" : "Play"}
                      onClick={() => setPlaying((value) => !value)}
                    >
                      <PlayerIcon playing={playing} />
                    </button>
                    <span>
                      {formatTime(current)} / {formatTime(duration)}
                    </span>
                    <button
                      type="button"
                      aria-label={muted ? "Unmute" : "Mute"}
                      onClick={() => setMuted((value) => !value)}
                    >
                      {muted ? "🔇" : "🔊"}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={muted ? 0 : volume}
                      aria-label="Volume"
                      onChange={(event) => {
                        setVolume(Number(event.target.value))

                        setMuted(false)
                      }}
                    />
                  </div>
                  <div className={styles.controlGroup}>
                    <button
                      type="button"
                      className={captions ? styles.activeControl : ""}
                      disabled={!subtitleCues}
                      aria-label={
                        subtitleCues
                          ? captions
                            ? "Turn subtitles off"
                            : "Turn English subtitles on"
                          : subtitleLoading
                            ? "Subtitles are loading"
                            : "Subtitles unavailable for this title"
                      }
                      aria-pressed={captions}
                      onClick={() => setCaptions((value) => !value)}
                    >
                      CC
                    </button>
                    <div className={styles.settingsAnchor}>
                      <button
                        type="button"
                        className={settingsOpen ? styles.activeControl : ""}
                        aria-label="Subtitles and video quality"
                        aria-expanded={settingsOpen}
                        onClick={() => {
                          setSettingsOpen((value) => !value)

                          setShowControls(true)
                        }}
                      >
                        <SettingsIcon />
                      </button>
                      {settingsOpen && (
                        <div
                          className={styles.playbackSettings}
                          role="dialog"
                          aria-label="Playback settings"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <section>
                            <h3>Video quality</h3>
                            <p>
                              {subscriptionLoading
                                ? "Checking your plan…"
                                : `${subscriptionPlan} plan`}
                            </p>
                            <div className={styles.settingOptions}>
                              {PLAYBACK_QUALITIES.map((quality) => {
                                const available =
                                  allowedQualities.includes(quality)

                                return (
                                  <button
                                    key={quality}
                                    type="button"
                                    disabled={!available || subscriptionLoading}
                                    aria-pressed={selectedQuality === quality}
                                    onClick={() => changeQuality(quality)}
                                  >
                                    <span>{quality}p</span>
                                    <small>
                                      {available
                                        ? selectedQuality === quality
                                          ? "Selected"
                                          : "Available"
                                        : `${requiredPlanForQuality(quality)} plan`}
                                    </small>
                                  </button>
                                )
                              })}
                            </div>
                          </section>
                          <section>
                            <h3>Subtitles</h3>
                            <div className={styles.settingOptions}>
                              <button
                                type="button"
                                aria-pressed={!captions}
                                onClick={() => setCaptions(false)}
                              >
                                <span>Off</span>
                              </button>
                              <button
                                type="button"
                                aria-pressed={captions}
                                disabled={!subtitleCues}
                                onClick={() => setCaptions(true)}
                              >
                                <span>
                                  {subtitleLoading
                                    ? "Loading"
                                    : subtitleCues
                                      ? "English"
                                      : subtitleError
                                        ? "Failed to load"
                                        : "Unavailable"}
                                </span>
                              </button>
                            </div>
                          </section>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={
                        isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                      }
                      onClick={() => void toggleFullscreen()}
                    >
                      <ExpandIcon active={isFullscreen} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section
          className={`${styles.contentInfo} ${styles.playbackChrome} ${
            playerUiVisible ? styles.playbackChromeVisible : ""
          }`}
          aria-hidden={!playerUiVisible}
        >
          <h1>{title}</h1>
          {isSeries && selectedEpisode && (
            <p>
              Episode {selectedEpisode.ep} · {selectedEpisode.title} ·{" "}
              {selectedEpisode.duration || "Runtime unavailable"}
            </p>
          )}
          <div className={styles.metadata}>
            {match > 0 && <strong>{match}% Match</strong>}
            {year && <span>{year}</span>}
            {rating && <span className={styles.rating}>{rating}</span>}
          </div>
          {current > 5 && (
            <div className={styles.savedProgress}>
              <span style={{ width: `${percent}%` }} />
              <p>
                {watched
                  ? "✓ Watched"
                  : `${Math.round(percent)}% watched · ${formatTime(duration - current)} remaining`}
              </p>
            </div>
          )}
        </section>

        <div className={styles.featureActions}>
          <button
            type="button"
            aria-label="Open movie music"
            aria-pressed={activePanel === "music"}
            className={activePanel === "music" ? styles.featureActive : ""}
            onClick={() => togglePanel("music")}
          >
            <MusicIcon />
            <span>Music</span>
          </button>
          <button
            type="button"
            aria-label={`Open ${isSeries ? "episode" : "movie"} refresher`}
            aria-pressed={activePanel === "refresher"}
            className={activePanel === "refresher" ? styles.featureActive : ""}
            onClick={() => togglePanel("refresher")}
          >
            <RefreshIcon />
            <span>Refresher</span>
          </button>
          <button
            type="button"
            aria-label="Open comments"
            aria-pressed={activePanel === "comments"}
            className={activePanel === "comments" ? styles.featureActive : ""}
            onClick={() => togglePanel("comments")}
          >
            <CommentsIcon />
            <span>Comments</span>
          </button>
          {isSeries && (
            <button
              type="button"
              aria-label="Open episodes"
              aria-pressed={activePanel === "episodes"}
              className={activePanel === "episodes" ? styles.featureActive : ""}
              onClick={() => togglePanel("episodes")}
            >
              <EpisodesIcon />
              <span>Episodes</span>
            </button>
          )}
        </div>

        {activePanel === "music" && (
          <section
            className={`${styles.featurePanel} ${styles.soundtrackPanel}`}
            aria-label={`Soundtrack for ${contentLabel}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.featureHeader}>
              <div>
                <MusicIcon />
                <h2>Soundtrack — {contentLabel}</h2>
              </div>
              <button
                ref={panelCloseRef}
                type="button"
                onClick={() => setActivePanel(null)}
                aria-label="Close soundtrack"
              >
                ×
              </button>
            </div>
            {soundtracksLoading ||
            (internalContentId === null && engagementLoading) ? (
              <p className={styles.soundtrackStatus} role="status">
                Loading soundtrack…
              </p>
            ) : soundtracksError ? (
              <p className={styles.soundtrackStatus} role="alert">
                The soundtrack could not be loaded. Try reopening this panel.
              </p>
            ) : soundtracks.length === 0 ? (
              <div className={styles.soundtrackEmpty}>
                <MusicIcon />
                <strong>No soundtrack available</strong>
                <p>
                  Audio tracks and lyrics for this title have not been added
                  yet.
                </p>
              </div>
            ) : (
              <div className={styles.trackList}>
                {soundtracks.map((track) => {
                  const lyricsOpen = lyricsTrackId === track.id

                  const trackIsPlaying =
                    activeSoundtrackId === track.id && soundtrackPlaying

                  return (
                    <article className={styles.trackRow} key={track.id}>
                      <span className={styles.musicTile}>
                        <MusicIcon />
                      </span>
                      <div className={styles.trackMeta}>
                        <strong>{track.title}</strong>
                        <small>{track.artist}</small>
                        {trackIsPlaying && (
                          <small className={styles.trackPlaybackStatus}>
                            Now playing
                          </small>
                        )}
                        {track.timestamp && (
                          <small>Featured at {track.timestamp}</small>
                        )}
                      </div>
                      <button
                        type="button"
                        className={styles.lyricsButton}
                        aria-expanded={lyricsOpen}
                        onClick={() => toggleLyrics(track)}
                      >
                        <LyricsIcon /> Lyrics
                      </button>
                      <button
                        type="button"
                        className={`${styles.trackPlayButton} ${
                          trackIsPlaying ? styles.trackPlayButtonActive : ""
                        }`}
                        disabled={!track.audioUrl}
                        aria-label={
                          !track.audioUrl
                            ? `Audio unavailable for ${track.title}`
                            : trackIsPlaying
                              ? `Pause ${track.title}`
                              : `Play ${track.title}`
                        }
                        aria-pressed={trackIsPlaying}
                        onClick={() => void toggleSoundtrackPlayback(track)}
                      >
                        {trackIsPlaying ? (
                          <TrackPauseIcon />
                        ) : (
                          <TrackPlayIcon />
                        )}
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
            {soundtrackPlaybackError && (
              <p className={styles.audioError} role="alert">
                {soundtrackPlaybackError}
              </p>
            )}
            {lyricsTrack && (
              <section
                className={styles.lyricsPanel}
                aria-labelledby="soundtrack-lyrics-title"
              >
                <div className={styles.lyricsHeading}>
                  <LyricsIcon />
                  <div>
                    <h3 id="soundtrack-lyrics-title">Lyrics</h3>
                    <p>
                      {lyricsTrack.title} — {lyricsTrack.artist}
                    </p>
                  </div>
                </div>
                <div className={styles.lyricsRule} />
                {lyricsTrack.lyrics ? (
                  <>
                    <p className={styles.lyricsText}>{lyricsTrack.lyrics}</p>
                    {lyricsTrack.lyricsSourceUrl && (
                      <a
                        className={styles.lyricsSource}
                        href={lyricsTrack.lyricsSourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Lyrics source
                      </a>
                    )}
                  </>
                ) : lyricsTrack.instrumental ? (
                  <p className={styles.lyricsUnavailable}>
                    Instrumental track — no lyrics.
                  </p>
                ) : lyricsLookup?.status === "loading" ? (
                  <p className={styles.lyricsUnavailable} role="status">
                    Searching for verified lyrics…
                  </p>
                ) : lyricsLookup?.status === "ready" &&
                  lyricsLookup.result.instrumental ? (
                  <p className={styles.lyricsUnavailable}>
                    Instrumental track — no lyrics.
                  </p>
                ) : lyricsLookup?.status === "ready" &&
                  lyricsLookup.result.lyrics ? (
                  <>
                    <p className={styles.lyricsText}>
                      {lyricsLookup.result.lyrics}
                    </p>
                    <a
                      className={styles.lyricsSource}
                      href="https://lrclib.net"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Lyrics provided by LRCLIB
                    </a>
                  </>
                ) : lyricsLookup?.status === "error" ? (
                  <p className={styles.lyricsUnavailable} role="alert">
                    Lyrics could not be loaded. Try again later.
                  </p>
                ) : (
                  <p className={styles.lyricsUnavailable}>
                    No verified lyrics were found for this track.
                  </p>
                )}
              </section>
            )}
          </section>
        )}

        {activePanel === "refresher" && (
          <section className={styles.featurePanel}>
            <div className={styles.featureHeader}>
              <div>
                <RefreshIcon />
                <h2>
                  {isSeries ? "Episode" : "Movie"} Refresher — {contentLabel}
                </h2>
              </div>
              <button
                ref={panelCloseRef}
                type="button"
                onClick={() => setActivePanel(null)}
                aria-label="Close refresher"
              >
                ×
              </button>
            </div>
            {refresherState.status === "loading" && (
              <p className={styles.refresherStatus} role="status">
                Finding a verified Wikipedia article…
              </p>
            )}
            {refresherState.status === "error" && (
              <div className={styles.refresherError} role="alert">
                <p>{refresherState.message}</p>
                <button type="button" onClick={() => void loadRefresher()}>
                  Try Again
                </button>
              </div>
            )}
            {refresherState.status === "ready" && (
              <>
                <p className={styles.refresherSummary}>
                  {refresherState.result.summary}
                </p>
                {isSeries && selectedEpisode && (
                  <p className={styles.refresherScopeNote}>
                    Wikipedia provides a series-level refresher for this title;
                    episode-specific details may be limited.
                  </p>
                )}
                <p className={styles.refresherSource}>
                  Source: {refresherState.result.sourceName} ·{" "}
                  <a
                    href={refresherState.result.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {refresherState.result.sourceTitle}
                  </a>
                </p>
              </>
            )}
            <div className={styles.refresherVideoAction}>
              <button
                type="button"
                onClick={() => void startRefresherVideo()}
                disabled={refresherVideoLoading}
              >
                <PlayerIcon playing={false} />
                {refresherVideoLoading
                  ? "Preparing Refresher…"
                  : "Play Refresher"}
              </button>
              {refresherVideoError && <p role="alert">{refresherVideoError}</p>}
            </div>
            {refresherState.status === "ready" &&
              (!spoilersRevealed ? (
                <button
                  type="button"
                  className={styles.spoilerButton}
                  onClick={() => setSpoilersRevealed(true)}
                >
                  ⚠ Reveal All
                </button>
              ) : (
                <div className={styles.refresherGrid}>
                  <RefresherSection
                    title="Key Events"
                    items={
                      refresherState.status === "ready" &&
                      refresherState.result.events.length
                        ? refresherState.result.events
                        : [
                            "Wikipedia does not provide a structured plot section for this title.",
                          ]
                    }
                  />
                  <RefresherSection
                    title="Important Characters"
                    items={
                      refresherState.status === "ready" &&
                      refresherState.result.characters.length
                        ? refresherState.result.characters
                        : [
                            "Wikipedia does not provide a structured character list for this title.",
                          ]
                    }
                  />
                  <RefresherSection
                    title="Key Details to Remember"
                    items={
                      refresherState.status === "ready" &&
                      refresherState.result.keyDetails.length
                        ? refresherState.result.keyDetails
                        : ["No additional verified story details were found."]
                    }
                  />
                </div>
              ))}
          </section>
        )}

        {isSeries && activePanel === "episodes" && (
          <section className={styles.episodesSection}>
            <div className={styles.featureHeader}>
              <div>
                <EpisodesIcon />
                <h2>Episodes</h2>
              </div>
              <button
                ref={panelCloseRef}
                type="button"
                onClick={() => setActivePanel(null)}
                aria-label="Close episodes"
              >
                ×
              </button>
            </div>
            {episodesLoading && (
              <p className={styles.status}>Loading episodes from TMDB…</p>
            )}
            {episodesError && !episodesLoading && (
              <p className={styles.status}>
                Episode information is currently unavailable.
              </p>
            )}
            <div className={styles.episodeList}>
              {episodes.map((episode) => {
                const key = `tv-${id}-episode-${episode.ep}`

                const episodeDuration = durationSeconds(episode.duration)

                const episodeProgress = progress[key] ?? 0

                const episodePercent = Math.min(
                  (episodeProgress / episodeDuration) * 100,

                  100,
                )

                const selected = selectedEpisode?.ep === episode.ep

                return (
                  <button
                    type="button"
                    key={episode.ep}
                    className={`${styles.episodeRow} ${
                      selected ? styles.episodeSelected : ""
                    }`}
                    onClick={() => selectEpisode(episode)}
                  >
                    <div className={styles.episodeThumb}>
                      {episode.thumb ? (
                        <img src={episode.thumb} alt="" />
                      ) : (
                        <span>E{episode.ep}</span>
                      )}
                      {selected && <em>▶ NOW</em>}
                      {episodeProgress > 0 && (
                        <i style={{ width: `${episodePercent}%` }} />
                      )}
                    </div>
                    <div className={styles.episodeInfo}>
                      <div>
                        <strong>
                          {episode.ep}. {episode.title}
                        </strong>
                        {selected && <small>Now Playing</small>}
                      </div>
                      <p>{episode.duration || "Runtime unavailable"}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <section
          className={`${styles.reactions} ${styles.playbackChrome} ${
            playerUiVisible ? styles.playbackChromeVisible : ""
          }`}
          aria-hidden={!playerUiVisible}
        >
          <h2>What did you think of this {isSeries ? "episode" : "movie"}?</h2>
          <p>
            {engagementLoading
              ? "Loading reactions…"
              : `${totalReactions} reactions`}
          </p>
          <div>
            {REACTION_DEFINITIONS.map(({ key, emoji, label }) => (
              <button
                type="button"
                key={key}
                disabled={
                  engagementLoading ||
                  reactionPending ||
                  internalContentId === null
                }
                aria-pressed={myReaction === key}
                className={myReaction === key ? styles.selectedReaction : ""}
                onClick={() => react(key)}
              >
                <span>{emoji}</span>
                <strong>{reactionCounts[key]}</strong>
                <small>{label}</small>
              </button>
            ))}
          </div>
        </section>

        {activePanel === "comments" && (
          <section className={styles.comments}>
            <div className={styles.featureHeader}>
              <div className={styles.commentsTitle}>
                <CommentsIcon />
                <h2>
                  {comments.length}{" "}
                  {comments.length === 1 ? "Comment" : "Comments"}
                </h2>
              </div>
              <button
                ref={panelCloseRef}
                type="button"
                onClick={() => setActivePanel(null)}
                aria-label="Close comments"
              >
                ×
              </button>
            </div>
            <div className={styles.commentComposer}>
              <span className={styles.commentComposerAvatar} aria-hidden="true">
                <span>
                  {initialsFor(activeProfile?.name ?? "StreamFlix member")}
                </span>
                {activeProfile?.avatar && (
                  <img
                    src={activeProfile.avatar}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = "none"
                    }}
                  />
                )}
              </span>
              <textarea
                rows={2}
                placeholder="Write a comment…"
                aria-label="Write a comment"
                maxLength={COMMENT_MAX_LENGTH}
                value={commentDraft}
                disabled={commentPending || internalContentId === null}
                onChange={(event) => setCommentDraft(event.target.value)}
              />
              <div className={styles.composerFooter}>
                <small>
                  {commentDraft.length}/{COMMENT_MAX_LENGTH}
                </small>
                <button
                  type="button"
                  className="px-6 py-2.5 bg-[var(--color-wine)] text-[var(--color-cream)] text-sm rounded-sm hover:bg-[var(--color-ink-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wine)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ink)]"
                  disabled={
                    commentPending ||
                    !commentDraft.trim() ||
                    internalContentId === null
                  }
                  onClick={() => void submitComment()}
                >
                  {commentPending ? "Posting…" : "Post Comment"}
                </button>
              </div>
            </div>
            {engagementError && (
              <p className={styles.engagementError} role="alert">
                {engagementError}
              </p>
            )}
            {engagementLoading ? (
              <p className={styles.commentStatus}>Loading comments…</p>
            ) : comments.length === 0 ? (
              <div className={styles.emptyComments}>
                <strong>No comments yet</strong>
                <p>Be the first to share your thoughts.</p>
              </div>
            ) : (
              <div className={styles.commentList}>
                {comments.map((comment) => {
                  const isOwnComment = comment.userId === engagementUserId

                  const useActiveProfileFallback =
                    isOwnComment && comment.memberProfileId === null

                  const authorName =
                    (useActiveProfileFallback
                      ? activeProfile?.name
                      : comment.authorName) ||
                    comment.authorName ||
                    "Community member"

                  const authorAvatar =
                    (useActiveProfileFallback
                      ? activeProfile?.avatar
                      : comment.authorAvatarUrl) || comment.authorAvatarUrl

                  return (
                    <article
                      key={comment.id}
                      className={styles.commentItem}
                      data-own-comment={isOwnComment ? "true" : "false"}
                    >
                      <span className={styles.commentAvatar} aria-hidden="true">
                        <span>{initialsFor(authorName)}</span>
                        {authorAvatar && (
                          <img
                            src={authorAvatar}
                            alt=""
                            onError={(event) => {
                              event.currentTarget.style.display = "none"
                            }}
                          />
                        )}
                      </span>
                      <header>
                        <strong>
                          {authorName}
                          {isOwnComment && (
                            <small className={styles.commentOwnerLabel}>
                              You
                            </small>
                          )}
                        </strong>
                        <time dateTime={comment.commentedAt}>
                          {new Date(comment.commentedAt).toLocaleDateString()}
                        </time>
                      </header>
                      {editingCommentId === comment.id ? (
                        <div className={styles.commentEditor}>
                          <textarea
                            rows={3}
                            maxLength={COMMENT_MAX_LENGTH}
                            value={editingCommentText}
                            disabled={commentActionPending === comment.id}
                            onChange={(event) =>
                              setEditingCommentText(event.target.value)
                            }
                            aria-label="Edit your comment"
                          />
                          <div>
                            <small>
                              {editingCommentText.length}/{COMMENT_MAX_LENGTH}
                            </small>
                            <button
                              type="button"
                              disabled={
                                !editingCommentText.trim() ||
                                commentActionPending === comment.id
                              }
                              onClick={() => void saveCommentEdit(comment.id)}
                            >
                              {commentActionPending === comment.id
                                ? "Saving…"
                                : "Save"}
                            </button>
                            <button
                              type="button"
                              disabled={commentActionPending === comment.id}
                              onClick={() => {
                                setEditingCommentId(null)

                                setEditingCommentText("")
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p>{comment.text}</p>
                      )}
                      {isOwnComment && editingCommentId !== comment.id && (
                        <div className={styles.commentActions}>
                          <button
                            type="button"
                            disabled={commentActionPending === comment.id}
                            onClick={() => {
                              setEditingCommentId(comment.id)

                              setEditingCommentText(comment.text)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={commentActionPending === comment.id}
                            onClick={() => setDeleteCommentId(comment.id)}
                          >
                            {commentActionPending === comment.id
                              ? "Deleting…"
                              : "Delete"}
                          </button>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {deleteCommentId && (
        <div
          className={styles.commentDeleteOverlay}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              commentActionPending !== deleteCommentId
            ) {
              setDeleteCommentId(null)
            }
          }}
        >
          <section
            className={styles.commentDeleteDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="comment-delete-title"
            aria-describedby="comment-delete-description"
          >
            <div className={styles.commentDeleteHeading}>
              <span aria-hidden="true">!</span>
              <div>
                <h2 id="comment-delete-title">Delete comment?</h2>
                <p id="comment-delete-description">
                  This comment will be permanently deleted and cannot be
                  recovered.
                </p>
              </div>
            </div>
            <div className={styles.commentDeleteActions}>
              <button
                type="button"
                disabled={commentActionPending === deleteCommentId}
                onClick={() => setDeleteCommentId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.commentDeleteConfirm}
                disabled={commentActionPending === deleteCommentId}
                onClick={() => void confirmCommentDeletion()}
              >
                {commentActionPending === deleteCommentId
                  ? "Deleting…"
                  : "Delete Comment"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
