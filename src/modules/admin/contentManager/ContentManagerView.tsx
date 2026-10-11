import { useCallback, useMemo, useState } from "react"
import type { Tab, Toast } from "./types"

import ContentTab from "./components/tabs/ContentTab"

import CategoriesTab from "./components/tabs/CategoriesTab"

import GenresTab from "./components/tabs/GenresTab"

import SoundtracksTab from "./components/tabs/SoundtracksTab"

import FilmRefreshersTab from "./components/tabs/FilmRefreshersTab"

import ToastContainer from "./components/shared/Toast"

import { useContentManagerData } from "./useContentManagerData"

import { AdminPageHeader } from "../components/AdminUI"

export default function ContentManagerView() {
  const [activeTab, setActiveTab] = useState<Tab>("content")
  const [streamFilter, setStreamFilter] = useState<"all" | "movies" | "tv">(
    "all",
  )
  const [addRequest, setAddRequest] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = String(Date.now())

    setToasts((t) => [...t, { id, message, type }])
  }, [])

  const dismissToast = useCallback(
    (id: string) => setToasts((t) => t.filter((x) => x.id !== id)),

    [],
  )

  const {
    content,

    categories,

    genres,

    soundtracks,

    refreshers,

    addContent,

    editContent,

    deleteContent,

    addCategory,

    editCategory,

    deleteCategory,

    addGenre,

    editGenre,

    deleteGenre,

    addSoundtrack,

    editSoundtrack,

    deleteSoundtrack,

    addRefresher,

    editRefresher,

    deleteRefresher,
  } = useContentManagerData((message) => addToast(message, "error"))

  const availableTitles = content.filter(
    (item) => item.availability === "available",
  ).length
  const availabilityPercent = content.length
    ? Math.round((availableTitles / content.length) * 100)
    : 0

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )
  const topStreamedTitles = useMemo(() => {
    return content
      .map((item) => {
        const categoryName = categoryNames.get(item.categoryId) ?? ""
        const kind = categoryName.toLowerCase().includes("tv") ? "tv" : "movies"
        return { ...item, kind }
      })
      .filter((item) => streamFilter === "all" || item.kind === streamFilter)
      .sort(
        (left, right) =>
          right.totalStreams - left.totalStreams ||
          left.title.localeCompare(right.title),
      )
      .slice(0, 10)
  }, [categoryNames, content, streamFilter])
  const largestStreamCount = Math.max(
    1,
    ...topStreamedTitles.map((item) => item.totalStreams),
  )
  const formatStreams = (value: number) =>
    new Intl.NumberFormat("en-US").format(value)

  const openAddTitle = () => {
    setActiveTab("content")
    setAddRequest((request) => request + 1)
  }

  return (
    <div className="admin-page-shell content-library-workspace">
      <AdminPageHeader
        eyebrow="Library operations"
        title="Content Management"
        description="Manage titles, metadata, availability, and media assets."
        actions={
          <button
            type="button"
            className="btn-primary flex items-center gap-2 px-5 py-2.5"
            onClick={openAddTitle}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add content
          </button>
        }
      />

      <div className="content-overview" aria-label="Catalog overview">
        <button
          type="button"
          className="content-overview__catalog"
          onClick={() => setActiveTab("content")}
          aria-pressed={activeTab === "content"}
          aria-label={`Catalog overview: ${content.length} titles. Open Content`}
        >
          <span className="content-overview__eyebrow">Catalog overview</span>
          <strong>{content.length} titles</strong>
          <span>Loaded content records</span>
          <span className="content-overview__coverage-label">
            <span>Available titles</span>
            <span>
              {availableTitles} of {content.length}
            </span>
          </span>
          <span
            className="content-overview__progress"
            role="progressbar"
            aria-label="Available catalog coverage"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={availabilityPercent}
          >
            <span style={{ width: `${availabilityPercent}%` }} />
          </span>
        </button>
        <div className="content-overview__metadata">
          <button
            type="button"
            className="content-overview__metric is-gold"
            onClick={() => setActiveTab("categories")}
            aria-pressed={activeTab === "categories"}
            aria-label={`Categories: ${categories.length}. Open Categories`}
          >
            <span>Categories</span>
            <strong>{categories.length}</strong>
            <small>Catalog groupings</small>
          </button>
          <button
            type="button"
            className="content-overview__metric is-blue"
            onClick={() => setActiveTab("genres")}
            aria-pressed={activeTab === "genres"}
            aria-label={`Genres: ${genres.length}. Open Genres`}
          >
            <span>Genres</span>
            <strong>{genres.length}</strong>
            <small>Discovery classifications</small>
          </button>
          <button
            type="button"
            className="content-overview__metric is-green"
            onClick={() => setActiveTab("soundtracks")}
            aria-pressed={activeTab === "soundtracks"}
            aria-label={`Soundtracks: ${soundtracks.length}. Open Soundtracks`}
          >
            <span>Soundtracks</span>
            <strong>{soundtracks.length}</strong>
            <small>Managed soundtrack records</small>
          </button>
          <button
            type="button"
            className="content-overview__metric is-rose"
            onClick={() => setActiveTab("film-refreshers")}
            aria-pressed={activeTab === "film-refreshers"}
            aria-label={`Film Refreshers: ${refreshers.length}. Open Film Refreshers`}
          >
            <span>Film Refreshers</span>
            <strong>{refreshers.length}</strong>
            <small>Managed refresher records</small>
          </button>
        </div>
      </div>

      {activeTab === "content" && (
        <section
          className="content-stream-chart"
          aria-labelledby="top-streamed-titles-heading"
        >
          <header className="content-stream-chart__header">
            <div>
              <h2 id="top-streamed-titles-heading">Top 10 streamed titles</h2>
              <p>Top titles by total streams</p>
            </div>
            <div
              className="content-stream-chart__filters"
              role="group"
              aria-label="Filter top streamed titles"
            >
              {([
                ["all", "All"],
                ["movies", "Movies"],
                ["tv", "TV Series"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={streamFilter === value ? "is-active" : ""}
                  aria-pressed={streamFilter === value}
                  onClick={() => setStreamFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          {topStreamedTitles.length ? (
            <ol className="content-stream-chart__list">
              {topStreamedTitles.map((item, index) => {
                const percentage = Math.max(
                  item.totalStreams > 0 ? 2 : 0,
                  (item.totalStreams / largestStreamCount) * 100,
                )
                return (
                  <li key={item.id} data-kind={item.kind}>
                    <span className="content-stream-chart__rank">
                      {index + 1}
                    </span>
                    <span className="content-stream-chart__title" title={item.title}>
                      {item.title}
                    </span>
                    <span
                      className="content-stream-chart__track"
                      role="img"
                      aria-label={`${item.title}: ${formatStreams(item.totalStreams)} streams`}
                    >
                      <span style={{ width: `${percentage}%` }} />
                    </span>
                    <strong>{formatStreams(item.totalStreams)}</strong>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="content-stream-chart__empty">
              No streamed titles are available for this filter.
            </p>
          )}

          <footer className="content-stream-chart__legend" aria-hidden="true">
            <span><i className="is-movie" /> Movies</span>
            <span><i className="is-tv" /> TV Series</span>
            <small>Streams</small>
          </footer>
        </section>
      )}

      <div>
        {/* Tab content */}
        <div className="admin-tab-panel">
          {activeTab === "content" && (
            <div
              role="tabpanel"
              id="tabpanel-content"
              aria-labelledby="tab-content"
            >
              <ContentTab
                content={content}
                categories={categories}
                genres={genres}
                onAdd={addContent}
                onEdit={editContent}
                onDelete={deleteContent}
                addToast={addToast}
                addRequest={addRequest}
              />
            </div>
          )}
          {activeTab === "categories" && (
            <div
              role="tabpanel"
              id="tabpanel-categories"
              aria-labelledby="tab-categories"
            >
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-white mb-1">
                  Categories
                </h2>
                <p className="text-sm" style={{ color: "#9CA3AF" }}>
                  Manage the categories used to organize STREAMFLIX content.
                </p>
              </div>
              <CategoriesTab
                categories={categories}
                onAdd={addCategory}
                onEdit={editCategory}
                onDelete={deleteCategory}
                addToast={addToast}
              />
            </div>
          )}
          {activeTab === "genres" && (
            <div
              role="tabpanel"
              id="tabpanel-genres"
              aria-labelledby="tab-genres"
            >
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-white mb-1">
                  Genres
                </h2>
                <p className="text-sm" style={{ color: "#9CA3AF" }}>
                  Manage the genres used to classify STREAMFLIX content.
                </p>
              </div>
              <GenresTab
                genres={genres}
                onAdd={addGenre}
                onEdit={editGenre}
                onDelete={deleteGenre}
                addToast={addToast}
              />
            </div>
          )}
          {activeTab === "soundtracks" && (
            <div
              role="tabpanel"
              id="tabpanel-soundtracks"
              aria-labelledby="tab-soundtracks"
            >
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-white mb-1">
                  Soundtracks
                </h2>
                <p className="text-sm" style={{ color: "#9CA3AF" }}>
                  Manage soundtrack information connected to STREAMFLIX content.
                </p>
              </div>
              <SoundtracksTab
                soundtracks={soundtracks}
                content={content}
                onAdd={addSoundtrack}
                onEdit={editSoundtrack}
                onDelete={deleteSoundtrack}
                addToast={addToast}
              />
            </div>
          )}
          {activeTab === "film-refreshers" && (
            <div
              role="tabpanel"
              id="tabpanel-film-refreshers"
              aria-labelledby="tab-film-refreshers"
            >
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-white mb-1">
                  Film Refreshers
                </h2>
                <p className="text-sm" style={{ color: "#9CA3AF" }}>
                  Manage summaries that help viewers remember previous films
                  before watching a sequel.
                </p>
              </div>
              <FilmRefreshersTab
                refreshers={refreshers}
                content={content}
                onAdd={addRefresher}
                onEdit={editRefresher}
                onDelete={deleteRefresher}
                addToast={addToast}
              />
            </div>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Inject animation keyframe */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
