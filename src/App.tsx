import { useCallback, useEffect, useRef, useState } from "react"

import type { Show } from "./modules/movie/types"

import type { Plan } from "./modules/subscription/SubscriptionPage"

import LoginPage from "./modules/login/LoginPage"

import RegisterPage from "./modules/register/RegisterPage"
import SubscriptionPage from "./modules/subscription/SubscriptionPage"
import ProfileSelectPage from "./modules/profileSelect/ProfileSelectPage"
import type { Profile } from "./modules/profileSelect/ProfileSelectPage"
import Dashboard from "./modules/dashboard/Dashboard"

import WatchScreen from "./modules/movie/fixedscreen/movie"

import AccountPage from "./modules/account/AccountPage"

import ProfilePage from "./modules/profile/ProfilePage"

import HelpPage from "./modules/help/HelpPage"

import SettingsPage from "./modules/settings/SettingsPage"

import PreviewModal from "./modules/movie/PreviewModal"
import { addOrUpdateContinue } from "./modules/dashboard/continueWatchingStore"
import AdminPage from "./modules/admin/AdminPage"
import { supabase } from "./lib/supabase"
import { getSignedInDestination } from "./lib/auth"
import ResetPasswordPage from "./modules/auth/ResetPasswordPage"
import { LOGO_SVG } from "./modules/auth/AuthUI"
import OpeningVideo from "./modules/auth/OpeningVideo"

type Page = "loading" | "login" | "opening" | "register" | "resetPassword" | "subscription" | "profileSelect" | "dashboard" | "watch" | "account" | "profile" | "help" | "settings" | "admin"

export default function App() {
  const [page, setPage] = useState<Page>("loading")

  const [plan, setPlan] = useState<Plan | null>(null)

  const [watchShow, setWatchShow] = useState<Show | null>(null)

  const [previewShow, setPreviewShow] = useState<Show | null>(null)

  const [activeProfileId, setActiveProfileId] = useState<number | null>(null)

  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)

  const activeProfileIdRef = useRef<number | null>(null)

  const activeAuthUserIdRef = useRef<string | null>(null)

  const openingStartedRef = useRef(false)

  const beginOpening = useCallback(() => {
    if (openingStartedRef.current) return
    openingStartedRef.current = true
    setPage("opening")
  }, [])

  const finishOpening = useCallback(() => {
    openingStartedRef.current = false
    setPage(activeProfileIdRef.current === null ? "profileSelect" : "dashboard")
  }, [])

  useEffect(() => {
    let mounted = true

    const routeSession = async (userId: string) => {
      try {
        if (activeAuthUserIdRef.current !== userId) {
          activeAuthUserIdRef.current = userId
          activeProfileIdRef.current = null
          if (mounted) setActiveProfileId(null)
          if (mounted) setActiveProfile(null)
        }
        const destination = await getSignedInDestination()
        if (!mounted) return
        if (!openingStartedRef.current) setPage(destination)
      } catch {
        if (mounted) setPage("login")
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (data.session) void routeSession(data.session.user.id)
      else setPage("login")
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        window.setTimeout(() => {
          if (!mounted) return
          if (event === "PASSWORD_RECOVERY") {
            setPage("resetPassword")
          } else if (event === "SIGNED_OUT") {
            activeAuthUserIdRef.current = null
            activeProfileIdRef.current = null
            setActiveProfileId(null)
            setActiveProfile(null)
            openingStartedRef.current = false
            setPage("login")
          } else if (event === "SIGNED_IN" && session) {
            if (
              activeAuthUserIdRef.current !== session.user.id ||
              activeProfileIdRef.current === null
            ) {
              void routeSession(session.user.id)
            }
          }
        }, 0)
      },
    )

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (page === "dashboard" && activeProfile === null) {
      setPage("profileSelect")
    }
  }, [activeProfile, page])

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const { profileId, name, avatarPath, avatar } = (event as CustomEvent<{
        profileId: number | string
        name: string
        avatarPath: string
        avatar: string
      }>).detail

      setActiveProfile((current) =>
        current && String(current.id) === String(profileId)
          ? { ...current, name, avatarPath, avatar }
          : current,
      )
    }

    window.addEventListener("streamflix:profile-updated", handleProfileUpdated)
    return () =>
      window.removeEventListener(
        "streamflix:profile-updated",
        handleProfileUpdated,
      )
  }, [])

  const handleWatch = (show: Show) => {
    addOrUpdateContinue(show, 1, undefined, activeProfileId)
    setWatchShow(show)
    setPreviewShow(null)

    setPage("watch")
  }

  const handleInfo = (show: Show) => {
    setPreviewShow(show)
  }

  const handleSignOut = () => {
    activeAuthUserIdRef.current = null
    activeProfileIdRef.current = null
    setActiveProfileId(null)
    setActiveProfile(null)
    openingStartedRef.current = false
    void supabase.auth.signOut().finally(() => setPage("login"))
  }

  return (
    <>
      {page === "loading" && (
        <div className="app-loading" role="status" aria-live="polite">
          <div className="app-loading__content">
            <div className="app-loading__logo">{LOGO_SVG}</div>
            <div className="app-loading__spinner" aria-hidden="true" />
            <p className="app-loading__text">Loading StreamFlix…</p>
          </div>
        </div>
      )}

      {page === "login" && <LoginPage onNavigate={(p) => setPage(p)} />}

      {page === "opening" && <OpeningVideo onComplete={finishOpening} />}

      {page === "resetPassword" && (
        <ResetPasswordPage onComplete={() => setPage("login")} />
      )}

      {page === "admin" && (
        <AdminPage
          onBack={() => setPage(activeProfile ? "dashboard" : "profileSelect")}
          onSignOut={handleSignOut}
          onNavigate={(p) => setPage(p)}
        />
      )}

      {page === "register" && <RegisterPage onNavigate={(p) => setPage(p)} />}

      {page === "subscription" && (
        <SubscriptionPage
          onComplete={() => setPage("profileSelect")}
          onBack={() => setPage("login")}
          onSubscribe={(p) => setPlan(p)}
        />
      )}

      {page === "profileSelect" && (
        <ProfileSelectPage
          maxProfiles={plan?.MaxUser ?? 1}
          onSelect={(profile: Profile) => {
            activeProfileIdRef.current = profile.id
            setActiveProfileId(profile.id)
            setActiveProfile(profile)
            beginOpening()
          }}
        />
      )}

      {page === "dashboard" && activeProfile && (
        <>
          <Dashboard
            activeProfile={activeProfile}
            onSignOut={handleSignOut}
            onWatch={handleWatch}
            onInfo={handleInfo}
            onNavigate={(p) => {
              if (p === "profileSelect") {
                activeProfileIdRef.current = null
                setActiveProfileId(null)
                setActiveProfile(null)
              }
              setPage(p)
            }}
          />
          {previewShow && (
            <PreviewModal
              show={previewShow}
              onClose={() => setPreviewShow(null)}
              onSelect={setPreviewShow}
              onPlay={(show) => {
                setPreviewShow(null)

                handleWatch(show)
              }}
            />
          )}
        </>
      )}

      {page === "watch" && watchShow && (
        <WatchScreen
          id={watchShow.id}
          title={watchShow.title}
          year={watchShow.year}
          rating={watchShow.rating}
          match={watchShow.match ?? 0}
          backgroundImage={watchShow.hero ?? watchShow.image}
          isSeries={watchShow.mediaType === "tv"}
          activeProfile={activeProfile}
            onProgress={(progress) =>
              addOrUpdateContinue(
                watchShow,
                progress,
                undefined,
                activeProfileId,
              )
            }
          onBack={() => setPage("dashboard")}
        />
      )}

      {page === "account" && (
        <AccountPage
          onBack={() => setPage("dashboard")}
          plan={plan}
          onPlanChange={(p) => {
            setPlan(p)
            activeProfileIdRef.current = null
            setActiveProfileId(null)
            setActiveProfile(null)
            setPage("profileSelect")
          }}
          onSubscriptionCancelled={() => {
            setPlan(null)
            setPage("subscription")
          }}
        />
      )}

      {page === "profile" && (
        <ProfilePage
          onBack={() => setPage("dashboard")}
          activeProfileId={activeProfileId}
          onProfileDeleted={() => {
            activeProfileIdRef.current = null
            setActiveProfileId(null)
            setActiveProfile(null)
            setPage("profileSelect")
          }}
        />
      )}

      {page === "help" && <HelpPage onBack={() => setPage("dashboard")} />}

      {page === "settings" && (
          <SettingsPage
            activeProfileId={activeProfileId ?? 0}
            onBack={() => setPage("dashboard")}
          />
      )}
    </>
  )
}
