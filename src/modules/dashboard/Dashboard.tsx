import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import type { Show } from "../movie/types"
import { Navbar, type DashboardView } from "./components"
import type { Profile } from "../profileSelect/ProfileSelectPage"
import CatalogPage from "./CatalogPage"
import { MyListView } from "./myList/components"
import SearchResultsPage from "./SearchResultsPage"

interface Props {
  activeProfile: Profile

  onSignOut: () => void

  onWatch: (show: Show) => void

  onInfo: (show: Show) => void

  onNavigate: (
    page:
      | "account"
      | "profile"
      | "help"
      | "settings"
      | "admin"
      | "profileSelect",
  ) => void
}

export default function Dashboard({
  activeProfile,
  onSignOut,
  onWatch,
  onInfo,
  onNavigate,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")

  const [view, setView] = useState<DashboardView>("home")

  const [showAdminLink, setShowAdminLink] = useState(false)

  useEffect(() => {
    let active = true
    void supabase.rpc("get_my_admin_access").then(({ data, error }) => {
      if (!active) return
      const status =
        data && typeof data === "object"
          ? String((data as { status?: unknown }).status).toLowerCase()
          : ""
      setShowAdminLink(!error && status === "active")
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="min-h-screen" style={{ background: "var(--color-ink)" }}>
      <Navbar
        currentProfile={activeProfile}
        activeView={view}
        onSignOut={onSignOut}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onNavigatePage={onNavigate}
        onNavigateView={(nextView) => {
          setSearchQuery("")
          setSearchOpen(false)
          setView(nextView)
        }}
        showAdminLink={showAdminLink}
      />

      {searchQuery.trim() && (
        <SearchResultsPage
          query={searchQuery}
          onWatch={onWatch}
          onInfo={onInfo}
          onNavigateHelp={() => onNavigate("help")}
        />
      )}
      {!searchQuery.trim() && view !== "myList" && (
        <CatalogPage
          kind={view}
          profileId={activeProfile.id}
          onWatch={onWatch}
          onInfo={onInfo}
          onNavigateHelp={() => onNavigate("help")}
        />
      )}
      {!searchQuery.trim() && view === "myList" && (
        <MyListView onBrowse={() => setView("home")} onInfo={onInfo} />
      )}
    </div>
  )
}
