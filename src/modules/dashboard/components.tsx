import { useEffect, useState, useRef, type RefObject } from "react"

import type { Show } from "../movie/types"

import { fetchTrailerKey } from "../movie/tmdb"

import styles from "./dashboard.module.css"

import { useMyList } from "./myList/myListStore"

import { useContinueWatching } from "./continueWatchingStore"

import { MAX_SEARCH_LENGTH } from "./search"

// ─── Logo ─────────────────────────────────────────────────────────────────────

export const LOGO_SVG = (
  <div className="flex items-center gap-2">
    <img src="/favicon.png" alt="" aria-hidden className="h-7 w-auto object-contain" />
    <svg viewBox="0 0 111.81 30" className="h-6 w-auto" aria-label="StreamFlix">
      <defs>
        <linearGradient id="sfGradNav" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F5A800" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <path
        fill="url(#sfGradNav)"
        d="M0.66 22.02V20.82H3.78V22.26Q3.78 24.3 5.49 24.3Q6.33 24.3 6.765 23.805Q7.2 23.31 7.2 22.2Q7.2 20.88 6.6 19.875Q6.0 18.87 4.38 17.46Q2.34 15.66 1.53 14.205Q0.72 12.75 0.72 10.92Q0.72 8.43 1.98 7.065Q3.24 5.7 5.64 5.7Q8.01 5.7 9.225 7.065Q10.44 8.43 10.44 10.98V11.85H7.32V10.77Q7.32 9.69 6.9 9.195Q6.48 8.7 5.67 8.7Q4.02 8.7 4.02 10.71Q4.02 11.85 4.635 12.84Q5.25 13.83 6.87 15.24Q8.94 17.04 9.72 18.51Q10.5 19.98 10.5 21.96Q10.5 24.54 9.225 25.92Q7.95 27.3 5.52 27.3Q3.12 27.3 1.89 25.935Q0.66 24.57 0.66 22.02Z M14.97 9.0H11.52V6.0H21.72V9.0H18.27V27.0H14.97Z M23.31 6.0H28.2Q30.75 6.0 31.92 7.185Q33.09 8.37 33.09 10.83V12.12Q33.09 15.39 30.93 16.26V16.32Q32.13 16.68 32.625 17.79Q33.12 18.9 33.12 20.76V24.45Q33.12 25.35 33.18 25.905Q33.24 26.46 33.48 27.0H30.12Q29.94 26.49 29.88 26.04Q29.82 25.59 29.82 24.42V20.58Q29.82 19.14 29.355 18.57Q28.89 18.0 27.75 18.0H26.61V27.0H23.31ZM27.81 15.0Q28.8 15.0 29.295 14.49Q29.79 13.98 29.79 12.78V11.16Q29.79 10.02 29.385 9.51Q28.98 9.0 28.11 9.0H26.61V15.0Z M35.4 6.0H44.4V9.0H38.7V14.55H43.23V17.55H38.7V24.0H44.4V27.0H35.4Z M48.84 6.0H53.31L56.73 27.0H53.43L52.83 22.83V22.89H49.08L48.48 27.0H45.42ZM52.44 20.04 50.97 9.66H50.91L49.47 20.04Z M58.32 6.0H63.03L65.13 21.03H65.19L67.29 6.0H72.0V27.0H68.88V11.1H68.82L66.42 27.0H63.66L61.26 11.1H61.2V27.0H58.32Z M74.46 6.0H83.19V9.0H77.76V14.85H82.02V17.85H77.76V27.0H74.46Z M84.78 6.0H88.08V24.0H93.51V27.0H84.78Z M95.1 6.0H98.4V27.0H95.1Z M103.77 16.26 100.14 6.0H103.62L105.84 12.78H105.9L108.18 6.0H111.3L107.67 16.26L111.48 27.0H108.0L105.6 19.68H105.54L103.08 27.0H99.96Z"
      />
    </svg>
  </div>
)

// ─── Icons ────────────────────────────────────────────────────────────────────

export function PlayIcon({
  size = 16,

  color = "var(--color-cream)",
}: {
  size?: number

  color?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
      <polygon points="3,2 13,8 3,14" />
    </svg>
  )
}

function CarouselArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M146 32C122 32 110 53 119 74L194 238C198 248 198 260 194 270L119 437C110 458 122 480 146 480C154 480 162 477 168 472L384 281C400 267 400 243 384 229L168 39C162 34 154 32 146 32Z"
        transform={
          direction === "left" ? "translate(512 0) scale(-1 1)" : undefined
        }
      />
    </svg>
  )
}

function CirclePlayIcon({
  size = 18,

  color = "#7C3AED",
}: {
  size?: number

  color?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill={color} />
      <polygon points="10,8 17,12 10,16" fill="white" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

type AccountMenuIconName =
  | "profile"
  | "account"
  | "settings"
  | "help"
  | "switchProfile"
  | "signout"

type AccountMenuPage =
  | "account"
  | "profile"
  | "help"
  | "settings"
  | "profileSelect"

const ACCOUNT_MENU_ITEMS: ReadonlyArray<{
  label: string
  page: AccountMenuPage
  icon: AccountMenuIconName
}> = [
  { label: "Profile", page: "profile", icon: "profile" },
  { label: "Account", page: "account", icon: "account" },
  { label: "Settings", page: "settings", icon: "settings" },
  { label: "Help Center", page: "help", icon: "help" },
  { label: "Change Profile", page: "profileSelect", icon: "switchProfile" },
]

function AccountMenuIcon({ name }: { name: AccountMenuIconName }) {
  const paths: Record<AccountMenuIconName, React.ReactNode> = {
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" />
      </>
    ),

    account: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8" cy="11" r="2" />
        <path d="M13 10h5M13 14h4" />
      </>
    ),

    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),

    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.7 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.1.9-1.1 1.8" />
        <path d="M12 17h.01" />
      </>
    ),

    switchProfile: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c.5-3.5 2.3-5.5 5.5-5.5 1.5 0 2.7.4 3.7 1.2M16 8h5m-2-2 2 2-2 2M21 16h-5m2-2-2 2 2 2" />
      </>
    ),

    signout: (
      <>
        <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
        <path d="m16 16 4-4-4-4M20 12H9" />
      </>
    ),
  }

  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function MuteIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ) : (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

// ─── Trending Card (landscape with persistent metadata + action buttons) ────

export function TrendingCard({
  show,

  onPlay,

  onInfo,

  posterStyle = false,

  unavailable = false,
}: {
  show: Show

  onPlay?: (show: Show) => void

  onInfo?: (show: Show) => void

  posterStyle?: boolean

  unavailable?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  const { isSaved, toggle } = useMyList()

  const mediaType = show.mediaType ?? "movie"

  const inList = isSaved(show.id, mediaType)

  return (
    <div
      className={`relative shrink-0 rounded-xl overflow-hidden ${
        unavailable ? styles.trendingCardUnavailable : "cursor-pointer"
      } ${styles.trendingCard} ${posterStyle ? styles.posterCarouselCard : ""}`}
      aria-disabled={unavailable || undefined}
      style={{
        transform: hovered && !unavailable
          ? posterStyle
            ? "translateY(-4px) scale(1.02)"
            : "scale(1.04)"
          : "scale(1)",

        transition: "transform 0.2s ease, box-shadow 0.2s ease",

        boxShadow: hovered && !unavailable
          ? "-10px 8px 28px rgba(0,0,0,0.58)"
          : posterStyle
            ? "-10px 0 24px rgba(0,0,0,0.45)"
            : "none",
      }}
      onMouseEnter={() => {
        if (!unavailable) setHovered(true)
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={unavailable ? undefined : () => onInfo?.(show)}
    >
      {/* thumbnail */}
      <div
        className={`relative w-full ${posterStyle ? styles.posterCardMedia : ""}`}
        style={posterStyle ? undefined : { aspectRatio: "16/10" }}
      >
        <img
          src={show.image}
          alt={show.title}
          className="w-full h-full object-cover"
        />
        <div className={`absolute inset-0 ${styles.trendingCardImgGradient}`} />
        <span
          className={`${styles.mediaTypeBadge} ${
            mediaType === "tv" ? styles.mediaTypeBadgeSeries : styles.mediaTypeBadgeMovie
          }`}
        >
          {mediaType === "tv" ? "TV Series" : "Movie"}
        </span>
      </div>

      {/* metadata always visible */}
      <div className={`px-2.5 pt-2 pb-2.5 ${styles.trendingMeta} ${posterStyle ? styles.posterCardMeta : ""}`}>
        {/* title row */}
        <div className="mb-1">
          <p className="text-[13px] font-semibold text-white leading-snug line-clamp-1 flex-1">
            {show.title}
          </p>
        </div>

        {/* match + year */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {typeof show.match === "number" && (
            <span className={`text-[11px] font-bold ${styles.matchText}`}>
              {show.match}% Match
            </span>
          )}
          <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
            • {show.year}
          </span>
        </div>

        {/* genre pill + action buttons */}
        <div className="flex items-center justify-between gap-2">
          {show.genres?.[0] ? (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${styles.trendingGenrePill}`}
            >
              {show.genres[0]}
            </span>
          ) : (
            <span />
          )}

          {unavailable ? (
            <span className={styles.unavailableBadge}>Unavailable</span>
          ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Play */}
            <button
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${styles.playBtn}`}
              aria-label="Play"
              onClick={(e) => {
                e.stopPropagation()

                onPlay?.(show)
              }}
            >
              <PlayIcon size={10} color="var(--color-ink)" />
            </button>
            {/* Add / Remove from list */}
            <button
              className={`w-7 h-7 flex items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                inList ? styles.listBtnActive : styles.listBtnInactive
              }`}
              aria-label={inList ? "Remove from list" : "Add to list"}
              onClick={(e) => {
                e.stopPropagation()

                toggle(show.id, mediaType, show)
              }}
            >
              {inList ? "✓" : "+"}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Continue Watching Card ───────────────────────────────────────────────────

export function ContinueWatchingCard({
  show,

  onPlay,

  onInfo,
}: {
  show: Show & {
    progress: number

    episodeLabel?: string
  }

  onPlay?: (show: Show) => void

  onInfo?: (show: Show) => void
}) {
  const [hovered, setHovered] = useState(false)

  const { isSaved, toggle } = useMyList()

  const mediaType = show.mediaType ?? "movie"

  const inList = isSaved(show.id, mediaType)

  return (
    <div
      className={`relative shrink-0 rounded-xl overflow-hidden cursor-pointer ${styles.continueCard}`}
      style={{
        transform: hovered ? "scale(1.03)" : "scale(1)",

        transition: "transform 0.2s ease, box-shadow 0.2s ease",

        boxShadow: hovered ? "0 8px 32px rgba(0,0,0,0.7)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onInfo?.(show)}
    >
      {/* thumbnail */}
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        <img
          src={show.hero ?? show.image}
          alt={show.title}
          className="w-full h-full object-cover"
        />
        <div className={`absolute inset-0 ${styles.continueImgGradient}`} />
        <span
          className={`${styles.mediaTypeBadge} ${
            mediaType === "tv"
              ? styles.mediaTypeBadgeSeries
              : styles.mediaTypeBadgeMovie
          }`}
        >
          {mediaType === "tv" ? "TV Series" : "Movie"}
        </span>
      </div>

      {/* bottom bar: title, episode, progress, actions */}
      <div className={`px-2.5 pt-2 pb-2.5 ${styles.continueMeta}`}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white leading-tight truncate">
              {show.title}
            </p>
            {"episodeLabel" in show && show.episodeLabel && (
              <p className="text-[10px] mt-0.5" style={{ color: "#9CA3AF" }}>
                {show.episodeLabel}
              </p>
            )}
          </div>
          {/* action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${styles.playBtn}`}
              aria-label="Play"
              onClick={(e) => {
                e.stopPropagation()

                onPlay?.(show)
              }}
            >
              <PlayIcon size={10} color="var(--color-ink)" />
            </button>
            <button
              className={`w-7 h-7 flex items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                inList ? styles.listBtnActive : styles.listBtnInactive
              }`}
              aria-label={inList ? "Remove from list" : "Add to list"}
              onClick={(e) => {
                e.stopPropagation()

                toggle(show.id, mediaType, show)
              }}
            >
              {inList ? "✓" : "+"}
            </button>
          </div>
        </div>
        {/* progress bar */}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${show.progress}%`,

                background: "#7C3AED",
              }}
            />
          </div>
          <span className="text-[10px] shrink-0" style={{ color: "#9CA3AF" }}>
            {show.progress}%
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Top-10 Card ──────────────────────────────────────────────────────────────

export function Top10Card({
  show,

  rank,

  onInfo,
}: {
  show: Show

  rank: number

  onInfo?: (show: Show) => void
}) {
  return (
    <button
      type="button"
      className={`${styles.top10Card} cursor-pointer`}
      onClick={() => onInfo?.(show)}
      aria-label={`View details for number ${rank}, ${show.title}`}
    >
      <span
        className={styles.rankNumber}
        aria-hidden="true"
      >
        {rank}
      </span>
      <div
        className={styles.top10Poster}
      >
        <img
          src={show.image}
          alt={show.title}
          className="w-full h-full object-cover"
        />
      </div>
    </button>
  )
}

// ─── Carousel Row ─────────────────────────────────────────────────────────────

export function CarouselRow({
  title,

  shows,

  top10,

  variant = "portrait",

  onPlay,

  onInfo,
}: {
  title: string

  shows: Array<Show & {
    progress?: number
  }>

  top10?: boolean

  variant?: "portrait" | "trending" | "continue"

  onPlay?: (show: Show) => void

  onInfo?: (show: Show) => void
}) {
  const posterStyleRows = new Set([
    "trending now",
    "new movies",
    "popular tv shows",
    "recommended movies",
    "recommended tv shows",
  ])
  const usePosterCards = posterStyleRows.has(title.toLowerCase())
  const ref = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const updateScrollState = () => {
    const element = ref.current
    if (!element) return
    setCanScrollLeft(element.scrollLeft > 2)
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 2)
  }
  useEffect(() => {
    const element = ref.current
    if (!element) return
    updateScrollState()
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(element)
    Array.from(element.children).forEach((child) => observer.observe(child))
    element.addEventListener("scroll", updateScrollState, { passive: true })
    return () => { observer.disconnect(); element.removeEventListener("scroll", updateScrollState) }
  }, [shows])
  if (shows.length === 0) return null

  const scroll = (dir: "left" | "right") => {
    if (!ref.current) return

    ref.current.scrollBy({
      left: dir === "right" ? 600 : -600,

      behavior: "smooth",
    })
  }

  return (
    <section className="px-4 sm:px-10 xl:px-12">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CirclePlayIcon size={20} />
          <h2 className={`text-base font-bold ${styles.rowTitle}`}>{title}</h2>
        </div>
      </div>

      <div className="relative group">
        {canScrollLeft && <button
          onClick={() => scroll("left")}
          className={`hidden sm:flex absolute left-0 top-0 bottom-0 z-10 w-12 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${styles.scrollFadeLeft}`}
          aria-label="Scroll left"
        >
          <span className={styles.scrollArrow}>
            <CarouselArrowIcon direction="left" />
          </span>
        </button>}

        <div
          ref={ref}
          className={top10 ? styles.top10Grid : `flex gap-3 overflow-x-auto pb-2 ${styles.noScrollbar}`}
        >
          {shows.slice(0, top10 ? 10 : shows.length).map((show, i) =>
            top10 ? (
              <Top10Card
                key={show.id}
                show={show}
                rank={i + 1}
                onInfo={onInfo}
              />
            ) : variant === "continue" ? (
              <ContinueWatchingCard
                key={show.id}
                show={{ ...show, progress: show.progress ?? 50 }}
                onPlay={onPlay}
                onInfo={onInfo}
              />
            ) : (
              <TrendingCard
                key={show.id}
                show={show}
                onPlay={onPlay}
                onInfo={onInfo}
                posterStyle={usePosterCards}
              />
            ),
          )}
        </div>

        {canScrollRight && <button
          onClick={() => scroll("right")}
          className={`hidden sm:flex absolute right-0 top-0 bottom-0 z-10 w-12 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${styles.scrollFadeRight}`}
          aria-label="Scroll right"
        >
          <span className={styles.scrollArrow}>
            <CarouselArrowIcon direction="right" />
          </span>
        </button>}
      </div>
    </section>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  "Home",

  "TV Shows",

  "Movies",

  "New & Popular",

  "My List",

  "Admin",
]

export type DashboardView = "home" | "tvShows" | "movies" | "newAndPopular" | "myList"

export interface AdminNavItem {
  id: string

  label: string
}

const VIEW_BY_LINK: Record<string, DashboardView | null> = {
  Home: "home",

  "TV Shows": "tvShows",

  Movies: "movies",

  "New & Popular": "newAndPopular",

  "My List": "myList",

  Admin: null,
}

const ADMIN_PROFILE_BY_ITEM: Record<string, {
  initial: string

  name: string

  role: string
}> = {
  master: { initial: "M", name: "Master Admin", role: "Administrator" },

  content: {
    initial: "C",
    name: "Content Manager",
    role: "Content Administrator",
  },

  comments: {
    initial: "C",

    name: "Comment Manager",

    role: "Community Manager",
  },

  feedback: {
    initial: "F",

    name: "Feedback Manager",

    role: "Feedback Manager",
  },

  users: { initial: "U", name: "User Manager", role: "User Manager" },

  system: { initial: "S", name: "System Manager", role: "System Manager" },
}

export function Navbar({
  currentProfile,

  onSignOut,

  searchOpen,

  setSearchOpen,

  searchQuery,

  onSearchQueryChange,

  onNavigatePage,

  onNavigateView,

  activeView,

  activePage,

  adminItems,

  activeAdminItem,

  onNavigateAdmin,

  onBackFromAdmin,

  onToggleAdminMenu,

  adminPageLabel,

  adminMenuButtonRef,

  adminMenuOpen = false,

  adminMenuLabel,

  showAdminLink = false,
}: {
  currentProfile?: {
    name: string
    avatar?: string | null
  } | null

  onSignOut: () => void

  searchOpen: boolean

  setSearchOpen: (v: boolean) => void

  searchQuery?: string

  onSearchQueryChange?: (value: string) => void

  onNavigatePage?: (
    page:
      | "account"
      | "profile"
      | "help"
      | "settings"
      | "admin"
      | "profileSelect",
  ) => void

  onNavigateView?: (view: DashboardView) => void

  activeView: DashboardView

  activePage?: "admin"

  adminItems?: readonly AdminNavItem[]

  activeAdminItem?: string

  onNavigateAdmin?: (id: string) => void

  onBackFromAdmin?: () => void

  onToggleAdminMenu?: () => void

  adminPageLabel?: string

  adminMenuButtonRef?: RefObject<HTMLButtonElement | null>

  adminMenuOpen?: boolean

  adminMenuLabel?: string

  showAdminLink?: boolean
}) {
  const [profileOpen, setProfileOpen] = useState(false)

  const [notifOpen, setNotifOpen] = useState(false)

  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const profileMenuRef = useRef<HTMLDivElement>(null)

  const notificationMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (!profileMenuRef.current?.contains(target)) setProfileOpen(false)

      if (!notificationMenuRef.current?.contains(target)) setNotifOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false)

        setNotifOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)

      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const adminProfileKey =
    adminItems && adminItems.length > 1
      ? "master"
      : (activeAdminItem ?? adminItems?.[0]?.id ?? "master")

  const adminProfile =
    activePage === "admin"
      ? (ADMIN_PROFILE_BY_ITEM[adminProfileKey] ?? ADMIN_PROFILE_BY_ITEM.master)
      : null

  const currentProfileInitial =
    currentProfile?.name.trim().charAt(0).toUpperCase() || "A"

  const navigateFromAccountMenu = (page: AccountMenuPage) => {
    setProfileOpen(false)
    setNotifOpen(false)
    setMobileNavOpen(false)
    onNavigatePage?.(page)
  }

  const visibleNavLinks = showAdminLink
    ? NAV_LINKS
    : NAV_LINKS.filter((link) => link !== "Admin")

  const navigateLink = (link: string) => {
    const target = VIEW_BY_LINK[link]

    if (target) onNavigateView?.(target)

    if (link === "Admin") onNavigatePage?.("admin")
  }

  const isActiveLink = (link: string) =>
    link === "Admin"
      ? activePage === "admin"
      : activePage !== "admin" && VIEW_BY_LINK[link] === activeView

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 flex items-center gap-4 sm:gap-6 px-4 sm:px-10 xl:px-12 h-14 ${styles.header} ${
        adminItems ? styles.adminHeader : ""
      } ${adminItems ? "admin-utility-header" : ""}`}
    >
      <button
        type="button"
        ref={adminItems ? adminMenuButtonRef : undefined}
        className={`${
          adminItems ? "admin-sidebar-menu-button" : "md:hidden"
        } flex flex-col justify-center gap-1 w-6 h-6`}
        onClick={() =>
          adminItems ? onToggleAdminMenu?.() : setMobileNavOpen((v) => !v)
        }
        aria-label={
          adminItems ? (adminMenuLabel ?? "Toggle navigation menu") : "Menu"
        }
        aria-expanded={adminItems ? adminMenuOpen : mobileNavOpen}
        aria-controls={adminItems ? "admin-sidebar-navigation" : undefined}
      >
        <span className={`block h-0.5 w-full ${styles.hamburgerBar}`} />
        <span className={`block h-0.5 w-full ${styles.hamburgerBar}`} />
        <span className={`block h-0.5 w-full ${styles.hamburgerBar}`} />
      </button>

      {adminItems && <button type="button" className="admin-utility-header__brand" onClick={() => onNavigateView?.("home")} aria-label="Go to StreamFlix home">{LOGO_SVG}</button>}

      {adminItems && <span className="admin-utility-header__divider" aria-hidden="true" />}

      {!adminItems && <button type="button" className="shrink-0 mr-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400" onClick={() => onNavigateView?.("home")} aria-label="Go to StreamFlix home">{LOGO_SVG}</button>}

      <nav
        aria-label={
          adminItems ? "Administrator workspaces" : "StreamFlix sections"
        }
        className={`${adminItems ? "flex" : "hidden md:flex"} ${
          adminItems ? "gap-3" : "gap-5"
        } items-center min-w-0`}
      >
        {adminItems ? (
          <span className="admin-utility-header__context">{adminPageLabel ?? "Administration"}</span>
        ) : (
          visibleNavLinks.map((link) => (
            <button
              key={link}
              className={`text-sm transition-colors whitespace-nowrap ${styles.navLink} ${
                isActiveLink(link)
                  ? styles.navLinkActive
                  : styles.navLinkInactive
              }`}
              onClick={() => navigateLink(link)}
            >
              {link}
            </button>
          ))
        )}
      </nav>

      {mobileNavOpen && (
        <nav
          className={`${
            adminItems ? "lg:hidden" : "md:hidden"
          } absolute top-14 left-0 right-0 flex flex-col py-2 ${styles.mobileNav}`}
        >
          {adminItems ? (
            <>
              <button
                type="button"
                className={`text-left px-4 py-2.5 text-sm ${styles.mobileNavLinkInactive}`}
                onClick={() => {
                  setMobileNavOpen(false)

                  onBackFromAdmin?.()
                }}
              >
                ← Back to StreamFlix
              </button>
              {adminItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`text-left px-4 py-2.5 text-sm ${
                    activeAdminItem === item.id
                      ? styles.mobileNavLinkActive
                      : styles.mobileNavLinkInactive
                  }`}
                  onClick={() => {
                    setMobileNavOpen(false)

                    onNavigateAdmin?.(item.id)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </>
          ) : (
            visibleNavLinks.map((link) => (
              <button
                key={link}
                className={`text-left px-4 py-2.5 text-sm ${
                  isActiveLink(link)
                    ? styles.mobileNavLinkActive
                    : styles.mobileNavLinkInactive
                }`}
                onClick={() => {
                  setMobileNavOpen(false)

                  navigateLink(link)
                }}
              >
                {link}
              </button>
            ))
          )}
        </nav>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-3 sm:gap-4">
        {!adminItems && (searchOpen ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              placeholder={
                adminItems ? "Search admin…" : "Search movies and shows..."
              }
              className={`w-32 sm:w-56 px-3 py-1.5 text-sm rounded-lg outline-none ${styles.searchInput}`}
              type="search"
              aria-label={
                adminItems
                  ? "Search administration"
                  : "Search movies and TV shows"
              }
              value={searchQuery}
              maxLength={MAX_SEARCH_LENGTH}
              onChange={(event) => onSearchQueryChange?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  onSearchQueryChange?.("")
                  setSearchOpen(false)
                }
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className={`transition-colors ${styles.iconBtn}`}
            aria-label="Search"
          >
            <SearchIcon />
          </button>
        ))}

        <div className="relative" ref={notificationMenuRef}>
          <button
            type="button"
            onClick={() => {
              setNotifOpen((n) => !n)

              setProfileOpen(false)
            }}
            className={`relative transition-colors ${styles.iconBtn}`}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            aria-haspopup="menu"
          >
            <BellIcon />
          </button>
          {notifOpen && (
            <div
              className={`absolute right-0 top-8 w-64 sm:w-72 rounded-xl overflow-hidden shadow-2xl ${styles.dropdown}`}
            >
              <div className={`px-4 py-4 ${styles.notifRow}`}>
                <span className={`text-xs ${styles.notifDesc}`}>
                  No new notifications.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => {
              setProfileOpen((p) => !p)

              setNotifOpen(false)
            }}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${styles.profileTrigger}`}
            aria-label={adminProfile ? "Open admin profile menu" : "Profile"}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <span
              className={`relative w-7 h-7 overflow-hidden rounded flex items-center justify-center text-xs font-bold shrink-0 ${styles.avatarBadge}`}
              aria-label={
                adminProfile
                  ? adminProfile.name
                  : currentProfile?.name ?? "Current profile"
              }
            >
              {adminProfile?.initial ?? currentProfileInitial}
              {!adminProfile && currentProfile?.avatar && (
                <img
                  src={currentProfile.avatar}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.hidden = true
                  }}
                />
              )}
            </span>
            {adminProfile && (
              <span className="hidden xl:flex flex-col text-left leading-tight">
                <span className="text-sm font-medium text-white">
                  {adminProfile.name}
                </span>
                <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
                  {adminProfile.role}
                </span>
              </span>
            )}
            <span
              className={`hidden sm:inline-flex ${styles.profileChevron} ${
                profileOpen ? styles.profileChevronOpen : ""
              }`}
            >
              <ChevronDown />
            </span>
          </button>
          {profileOpen && (
            <div
              className={`absolute right-0 top-11 ${styles.profileMenu}`}
              role="menu"
              aria-label="Account menu"
            >
              {adminProfile ? (
                <>
                  <div className="px-4 py-3">
                    <p className="text-sm font-medium text-white">
                      {adminProfile.name}
                    </p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>
                      {adminProfile.role}
                    </p>
                  </div>
                  <div className={`border-t ${styles.dropdownDivider}`} />
                  <button
                    type="button"
                    onClick={() => navigateFromAccountMenu("account")}
                    className={styles.profileMenuItem}
                    role="menuitem"
                  >
                    <AccountMenuIcon name="account" />
                    Account / Profile
                  </button>
                </>
              ) : (
                ACCOUNT_MENU_ITEMS.map(
                  (item) => (
                    <button
                      key={item.page}
                      type="button"
                      onClick={() => navigateFromAccountMenu(item.page)}
                      className={styles.profileMenuItem}
                      role="menuitem"
                    >
                      <AccountMenuIcon name={item.icon} />
                      {item.label}
                    </button>
                  ),
                )
              )}
              <div className={styles.profileMenuDivider} />
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false)

                  onSignOut()
                }}
                className={`${styles.profileMenuItem} ${styles.profileMenuSignOut}`}
                role="menuitem"
              >
                <AccountMenuIcon name="signout" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function Hero({
  shows,

  onWatch,

  onInfo,
}: {
  shows: Show[]

  onWatch: (show: Show) => void

  onInfo: (show: Show) => void
}) {
  const slides = shows.slice(0, 5)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(false)
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const [showTrailer, setShowTrailer] = useState(false)
  const [trailerLoaded, setTrailerLoaded] = useState(false)
  const [trailerPlaying, setTrailerPlaying] = useState(false)
  const [heroVisible, setHeroVisible] = useState(true)
  const heroRef = useRef<HTMLElement>(null)
  const trailerRef = useRef<HTMLIFrameElement>(null)
  const trailerRevealTimerRef = useRef<number | null>(null)
  const dragStartRef = useRef<{
    x: number
    y: number
    pointerId: number
  } | null>(null)
  const show = slides[activeIndex] ?? slides[0]

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0)
  }, [activeIndex, slides.length])

  useEffect(() => {
    if (
      !heroVisible ||
      slides.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % slides.length)
    }, 20_000)

    return () => window.clearTimeout(timer)
  }, [heroVisible, slides.length, activeIndex])

  const selectSlide = (index: number) => {
    setActiveIndex((index + slides.length) % slides.length)
  }

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (
      slides.length < 2 ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      (event.target as HTMLElement).closest("button, a, input, select, textarea")
    ) {
      return
    }

    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    const start = dragStartRef.current
    dragStartRef.current = null
    if (!start || start.pointerId !== event.pointerId) return

    const distanceX = event.clientX - start.x
    const distanceY = event.clientY - start.y
    if (Math.abs(distanceX) >= 60 && Math.abs(distanceX) > Math.abs(distanceY)) {
      selectSlide(activeIndex + (distanceX < 0 ? 1 : -1))
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const bg = show.hero ?? show.image

  const genreTag = show.genres?.[0] ?? "Drama"

  useEffect(() => {
    let cancelled = false
    setMuted(false)
    setTrailerKey(null)
    setShowTrailer(false)
    setTrailerLoaded(false)
    setTrailerPlaying(false)

    const timer = window.setTimeout(() => {
      if (!cancelled) setShowTrailer(true)
    }, 3_000)

    void fetchTrailerKey(show.id, show.mediaType ?? "movie").then((key) => {
      if (!cancelled) setTrailerKey(key)
    })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (trailerRevealTimerRef.current !== null) {
        window.clearTimeout(trailerRevealTimerRef.current)
        trailerRevealTimerRef.current = null
      }
    }
  }, [show.id, show.mediaType])

  useEffect(() => {
    const handleTrailerMessage = (event: MessageEvent) => {
      if (event.source !== trailerRef.current?.contentWindow) return

      let message: { event?: string; info?: number } | null = null
      try {
        message =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data
      } catch {
        return
      }

      if (message?.event === "onReady") {
        trailerRef.current?.contentWindow?.postMessage(
          JSON.stringify({
            event: "command",
            func: "addEventListener",
            args: ["onStateChange"],
          }),
          "*",
        )
        trailerRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "playVideo", args: [] }),
          "*",
        )
      }

      if (message?.event === "onStateChange" && message.info === 1) {
        if (trailerRevealTimerRef.current !== null) {
          window.clearTimeout(trailerRevealTimerRef.current)
        }
        // Keep YouTube's startup transport controls behind the hero poster until
        // its play, pause, rewind, and fast-forward overlay has auto-hidden.
        trailerRevealTimerRef.current = window.setTimeout(() => {
          setTrailerPlaying(true)
          trailerRevealTimerRef.current = null
        }, 5_000)
      }
    }

    window.addEventListener("message", handleTrailerMessage)
    return () => window.removeEventListener("message", handleTrailerMessage)
  }, [trailerKey])

  useEffect(() => {
    const element = heroRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio > 0.1
        setHeroVisible(visible)
        if (!visible) {
          setTrailerLoaded(false)
          setTrailerPlaying(false)
          if (trailerRevealTimerRef.current !== null) {
            window.clearTimeout(trailerRevealTimerRef.current)
            trailerRevealTimerRef.current = null
          }
        }
      },
      { threshold: [0, 0.1, 0.25] },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const trailerVisible =
    showTrailer && heroVisible && trailerLoaded && trailerPlaying

  useEffect(() => {
    if (!trailerVisible) return
    trailerRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: muted ? "mute" : "unMute",
        args: [],
      }),
      "*",
    )
  }, [muted, trailerVisible])

  const trailerUrl = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${trailerKey}&rel=0&disablekb=1&fs=0&iv_load_policy=3&enablejsapi=1`
    : null

  return (
    <section
      ref={heroRef}
      className={`relative w-full ${styles.heroRoot} ${slides.length > 1 ? styles.heroDraggable : ""}`}
      style={{ height: "56vh", minHeight: 340 }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Top 5 featured titles"
      onPointerDown={startDrag}
      onPointerUp={finishDrag}
      onPointerCancel={() => {
        dragStartRef.current = null
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      <img
        src={bg}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      {heroVisible && trailerUrl && (
        <iframe
          ref={trailerRef}
          key={trailerKey}
          className={styles.heroTrailer}
          src={trailerUrl}
          title={`${show.title} trailer`}
          allow="autoplay; encrypted-media; picture-in-picture"
          tabIndex={-1}
          aria-hidden="true"
          onLoad={() => {
            setTrailerLoaded(true)
            setTrailerPlaying(false)
            if (trailerRevealTimerRef.current !== null) {
              window.clearTimeout(trailerRevealTimerRef.current)
              trailerRevealTimerRef.current = null
            }
            trailerRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: "listening", id: "hero-trailer" }),
              "*",
            )
            trailerRef.current?.contentWindow?.postMessage(
              JSON.stringify({
                event: "command",
                func: "addEventListener",
                args: ["onStateChange"],
              }),
              "*",
            )
          }}
        />
      )}
      {heroVisible && trailerUrl && (
        <img
          src={bg}
          alt=""
          aria-hidden="true"
          className={`${styles.heroTrailerCover} ${trailerVisible ? styles.heroTrailerCoverHidden : ""}`}
        />
      )}
      <div className={`absolute inset-0 ${styles.heroDim}`} />
      <div className={`absolute inset-0 ${styles.heroGradientRight}`} />
      <div className={`absolute inset-0 ${styles.heroGradientTop}`} />

      {slides.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.heroCarouselArrow} ${styles.heroCarouselArrowLeft}`}
            onClick={(event) => {
              event.stopPropagation()
              selectSlide(activeIndex - 1)
            }}
            aria-label="Show previous featured title"
          >
            <CarouselArrowIcon direction="left" />
          </button>
          <button
            type="button"
            className={`${styles.heroCarouselArrow} ${styles.heroCarouselArrowRight}`}
            onClick={(event) => {
              event.stopPropagation()
              selectSlide(activeIndex + 1)
            }}
            aria-label="Show next featured title"
          >
            <CarouselArrowIcon direction="right" />
          </button>
        </>
      )}

      <div className="absolute z-[4] bottom-16 sm:bottom-20 left-4 sm:left-10 xl:left-12 right-4 sm:right-auto max-w-[540px]">
        {/* Genre tag replaces "StreamFlix Original" */}
        <p className={`text-[11px] font-semibold mb-3 ${styles.heroEyebrow}`}>
          Top {activeIndex + 1} of {slides.length} · {genreTag}
        </p>
        <h1
          className={`text-3xl sm:text-5xl xl:text-6xl uppercase leading-none mb-4 ${styles.heroTitle}`}
        >
          {show.title}
        </h1>
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {typeof show.match === "number" && (
            <span className={`text-[11px] font-bold ${styles.heroMatch}`}>
              {show.match}% Match
            </span>
          )}
          <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
            • {show.year}
          </span>
        </div>
        <p
          className={`text-sm leading-relaxed mb-6 line-clamp-3 sm:line-clamp-4 ${styles.heroDescription}`}
        >
          {show.description || "No description available."}
        </p>
        <div className="flex gap-3">
          <button
            className={`flex items-center gap-2 px-6 sm:px-8 py-3 text-sm font-bold transition-all duration-150 active:scale-[0.98] ${styles.heroPlayBtn}`}
            onClick={() => onWatch(show)}
          >
            <PlayIcon size={14} color="var(--color-ink)" />
            Play
          </button>
          <button
            className={`flex items-center gap-2 px-6 sm:px-8 py-3 text-sm font-bold transition-all duration-150 active:scale-[0.98] ${styles.heroInfoBtn}`}
            onClick={() => onInfo(show)}
          >
            <span className="text-base leading-none">ⓘ</span>
            More Info
          </button>
        </div>
      </div>

      <div className="absolute z-[4] bottom-20 right-4 sm:right-10 xl:right-12 flex flex-col items-end gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMuted((m) => !m)
            }}
            className={`w-9 h-9 flex items-center justify-center transition-colors ${styles.heroMuteBtn}`}
            aria-label={muted ? "Unmute" : "Mute"}
            disabled={!trailerVisible || !trailerKey}
          >
            <MuteIcon muted={muted} />
          </button>
        </div>
        <span
          className={`px-2 py-0.5 text-xs font-bold ${styles.heroRatingBadge}`}
        >
          {show.rating}
        </span>
      </div>

      {slides.length > 1 && (
        <div className={styles.heroCarouselDots} aria-label="Choose featured title">
          {slides.map((slide, index) => (
            <button
              key={`${slide.mediaType ?? "movie"}-${slide.id}`}
              type="button"
              className={`${styles.heroCarouselDot} ${index === activeIndex ? styles.heroCarouselDotActive : ""}`}
              onClick={() => selectSlide(index)}
              aria-label={`Show ${index + 1}: ${slide.title}`}
              aria-current={index === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Genre Filters ────────────────────────────────────────────────────────────

export const GENRES = [
  "All",
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
]

export function GenreFilters({
  active,

  setActive,

  genres = GENRES,
}: {
  active: string

  setActive: (g: string) => void

  genres?: string[]
}) {
  return (
    <div className="flex items-center gap-2 px-4 sm:px-10 xl:px-12 py-4 flex-wrap">
      <span className={`text-sm font-semibold mr-1 ${styles.genresLabel}`}>
        Genres
      </span>
      {genres.map((g) => (
        <button
          key={g}
          onClick={() => setActive(g)}
          className={`px-4 py-1.5 rounded-full text-sm transition-all duration-150 ${
            active === g ? styles.genrePillActive : styles.genrePillInactive
          }`}
        >
          {g}
        </button>
      ))}
    </div>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

const FOOTER_LINKS = [
  "Help Center",
  "Terms of Use",
  "Privacy",
  "Cookie Preferences",
  "Contact Us",
]

// ─── Continue Watching Row ────────────────────────────────────────────────────

export function ContinueWatchingRow({
  onPlay,

  onInfo,

  genre = "All",
  profileId,
}: {
  onPlay?: (show: Show) => void

  onInfo?: (show: Show) => void

  genre?: string
  profileId: number
}) {
  const { entries } = useContinueWatching(10, profileId)
  const normalizedGenre = genre.trim().toLowerCase()
  const filteredEntries =
    normalizedGenre === "all"
      ? entries
      : entries.filter((entry) =>
          entry.show.genres.some(
            (showGenre) => showGenre.trim().toLowerCase() === normalizedGenre,
          ),
        )

  if (filteredEntries.length === 0) return null

  const showsWithProgress = filteredEntries.map((e) => ({
    ...e.show,

    progress: e.progress,

    episodeLabel: e.episodeLabel,
  }))

  return (
    <CarouselRow
      title="Continue Watching"
      shows={showsWithProgress}
      variant="continue"
      onPlay={onPlay}
      onInfo={onInfo}
    />
  )
}

export function Footer({ onNavigateHelp }: { onNavigateHelp?: () => void }) {
  return (
    <footer className={`px-4 sm:px-10 xl:px-12 py-10 mt-8 ${styles.footer}`}>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4">
        {FOOTER_LINKS.map((link) => (
          <button
            type="button"
            key={link}
            onClick={
              link === "Help Center" || link === "Contact Us"
                ? onNavigateHelp
                : undefined
            }
            className={`text-xs transition-colors ${styles.footerLink}`}
          >
            {link}
          </button>
        ))}
      </div>
      <p className={`text-xs ${styles.footerCopy}`}>&copy; STREAMFLIX 2026</p>
    </footer>
  )
}
