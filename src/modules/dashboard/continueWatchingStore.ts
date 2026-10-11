import { useCallback, useEffect, useState } from "react"

import type { Show } from "../movie/types"

export interface ContinueEntry {
  show: Show

  progress: number // 0–100

  episodeLabel?: string

  updatedAt: number
}

// Keep viewing progress isolated by profile on shared subscriber accounts.
const KEY = "sf_continue_watching_v3"
const EVENT = "sf-continue-change"

function storageKey(profileId?: number | null) {
  return `${KEY}:${profileId ?? "default"}`
}

function load(profileId?: number | null): ContinueEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey(profileId)) ?? "[]")

    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function persist(entries: ContinueEntry[], profileId?: number | null) {
  localStorage.setItem(storageKey(profileId), JSON.stringify(entries))

  window.dispatchEvent(new Event(EVENT))
}

export function addOrUpdateContinue(
  show: Show,
  progress: number,
  episodeLabel?: string,
  profileId?: number | null,
) {
  const entries = load(profileId).filter(
    (e) => !(e.show.id === show.id && e.show.mediaType === show.mediaType),
  )

  persist(
    [{ show, progress, episodeLabel, updatedAt: Date.now() }, ...entries],
    profileId,
  )
}

export function removeContinue(
  id: number,
  mediaType: Show["mediaType"],
  profileId?: number | null,
) {
  persist(
    load(profileId).filter(
      (e) => !(e.show.id === id && e.show.mediaType === mediaType),
    ),
    profileId,
  )
}

export function clearContinueWatching(profileId?: number | null) {
  persist([], profileId)
}

export function useContinueWatching(
  limit: number | null = 10,
  profileId?: number | null,
) {
  const [entries, setEntries] = useState<ContinueEntry[]>(() => load(profileId))

  useEffect(() => {
    const refresh = () => setEntries(load(profileId))

    window.addEventListener(EVENT, refresh)

    window.addEventListener("storage", refresh)

    return () => {
      window.removeEventListener(EVENT, refresh)

      window.removeEventListener("storage", refresh)
    }
  }, [profileId])

  const markWatched = useCallback(
    (show: Show, progress: number, episodeLabel?: string) => {
      addOrUpdateContinue(show, progress, episodeLabel, profileId)
    },
    [profileId],
  )

  const remove = useCallback((id: number, mediaType: Show["mediaType"]) => {
    removeContinue(id, mediaType, profileId)
  }, [profileId])

  const clear = useCallback(() => {
    clearContinueWatching(profileId)
  }, [profileId])

  const sorted = [...entries].sort((a, b) => b.updatedAt - a.updatedAt)

  const visibleEntries = limit === null ? sorted : sorted.slice(0, limit)

  return { entries: visibleEntries, markWatched, remove, clear }
}
