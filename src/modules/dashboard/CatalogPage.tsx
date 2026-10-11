import { useState } from "react"
import type { Show, TMDBCatalogData, CatalogKind } from "../movie/types"
import { useSupabaseCatalog } from "../movie/useSupabaseCatalog"
import {
  CarouselRow,
  ContinueWatchingRow,
  Footer,
  GenreFilters,
  Hero,
} from "./components"

interface CatalogPageProps {
  kind: CatalogKind
  profileId: number
  onWatch: (show: Show) => void
  onInfo: (show: Show) => void
  onNavigateHelp: () => void
}

interface CatalogViewProps extends Omit<CatalogPageProps, "kind"> {
  data: TMDBCatalogData
  showHero?: boolean
}

const SKELETON_ROWS = [1, 2, 3]
const SKELETON_CARDS = [1, 2, 3, 4, 5]

function LoadingCatalog({ showHero }: { showHero: boolean }) {
  return (
    <div>
      {showHero && (
        <div
          style={{ height: "56vh", minHeight: 340, background: "#150D2A" }}
        />
      )}
      <div className="pt-6 px-4 sm:px-10 xl:px-12 space-y-8">
        {SKELETON_ROWS.map((row) => (
          <div key={row} className="mb-8">
            <div className="h-5 w-40 rounded mb-3 bg-[#1A1030]" />
            <div className="flex gap-3">
              {SKELETON_CARDS.map((card) => (
                <div
                  key={card}
                  className="rounded-xl shrink-0 w-[200px] h-[120px] bg-[#1A1030]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CatalogView({
  data,
  showHero = false,
  onWatch,
  onInfo,
  onNavigateHelp,
  profileId,
}: CatalogViewProps) {
  const [genre, setGenre] = useState("All")
  const { rows, featured, genres, loading } = data

  if (loading) return <LoadingCatalog showHero={showHero} />

  const filteredRows = rows.map((row) => ({
    ...row,
    shows:
      genre === "All"
        ? row.shows
        : row.shows.filter((show) =>
            show.genres.some(
              (showGenre) => showGenre.toLowerCase() === genre.toLowerCase(),
            ),
          ),
  }))
  const heroShows =
    rows.find((row) => row.title === "Trending Now")?.shows.slice(0, 5) ??
    (featured ? [featured] : [])

  return (
    <div className={showHero ? undefined : "pt-20"}>
      {showHero && heroShows.length > 0 && (
        <Hero shows={heroShows} onWatch={onWatch} onInfo={onInfo} />
      )}
      <div className="space-y-8 pb-10">
        <GenreFilters
          active={genre}
          setActive={setGenre}
          genres={["All", ...genres.slice(0, 15)]}
        />
        <ContinueWatchingRow
          genre={genre}
          profileId={profileId}
          onPlay={onWatch}
          onInfo={onInfo}
        />
        {filteredRows.map((row) => (
          <CarouselRow
            key={row.title}
            title={row.title}
            shows={row.shows}
            top10={row.top10}
            onPlay={onWatch}
            onInfo={onInfo}
          />
        ))}
        <Footer onNavigateHelp={onNavigateHelp} />
      </div>
    </div>
  )
}

export default function CatalogPage({
  kind,
  onWatch,
  onInfo,
  onNavigateHelp,
  profileId,
}: CatalogPageProps) {
  const data = useSupabaseCatalog(kind)

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--color-cream)]">
      <CatalogView
        data={data}
        showHero={kind === "home"}
        onWatch={onWatch}
        onInfo={onInfo}
        onNavigateHelp={onNavigateHelp}
        profileId={profileId}
      />
    </div>
  )
}
