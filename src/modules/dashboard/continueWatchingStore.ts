import { useCallback, useEffect, useState } from "react"

import type { Show } from "../movie/types"

export interface ContinueEntry {
  show: Show

  progress: number // 0–100

  episodeLabel?: string

  updatedAt: number
}

// v2 intentionally ignores data stored by earlier builds.
const KEY = "sf_continue_watching_v2"
const EVENT = "sf-continue-change"

function load(): ContinueEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]")

    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function persist(entries: ContinueEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries))

  window.dispatchEvent(new Event(EVENT))
}

export function addOrUpdateContinue(
  show: Show,
  progress: number,
  episodeLabel?: string,
) {
  const entries = load().filter(
    (e) => !(e.show.id === show.id && e.show.mediaType === show.mediaType),
  )

  persist([{ show, progress, episodeLabel, updatedAt: Date.now() }, ...entries])
}

export function removeContinue(id: number, mediaType: Show["mediaType"]) {
  persist(
    load().filter((e) => !(e.show.id === id && e.show.mediaType === mediaType)),
  )
}

export function clearContinueWatching() {
  persist([])
}

export function useContinueWatching(limit: number | null = 10) {
  const [entries, setEntries] = useState<ContinueEntry[]>(load)

  useEffect(() => {
    const refresh = () => setEntries(load())

    window.addEventListener(EVENT, refresh)

    window.addEventListener("storage", refresh)

    return () => {
      window.removeEventListener(EVENT, refresh)

      window.removeEventListener("storage", refresh)
    }
  }, [])

  const markWatched = useCallback(
    (show: Show, progress: number, episodeLabel?: string) => {
      addOrUpdateContinue(show, progress, episodeLabel)
    },
    [],
  )

  const remove = useCallback((id: number, mediaType: Show["mediaType"]) => {
    removeContinue(id, mediaType)
  }, [])

  const clear = useCallback(() => {
    clearContinueWatching()
  }, [])

  const sorted = [...entries].sort((a, b) => b.updatedAt - a.updatedAt)

  const visibleEntries = limit === null ? sorted : sorted.slice(0, limit)

  return { entries: visibleEntries, markWatched, remove, clear }
}
