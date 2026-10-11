import { useSyncExternalStore } from "react"

export const SUBTITLE_SIZE_OPTIONS = [
  "Small",
  "Medium",
  "Large",
  "Extra Large",
] as const

export type SubtitleSize = (typeof SUBTITLE_SIZE_OPTIONS)[number]

const SUBTITLE_SIZE_KEY = "sf_subtitle_size_v1"
const SUBTITLE_SIZE_EVENT = "streamflix:subtitle-size-updated"
const DEFAULT_SUBTITLE_SIZE: SubtitleSize = "Medium"

function isSubtitleSize(value: string | null): value is SubtitleSize {
  return SUBTITLE_SIZE_OPTIONS.some((option) => option === value)
}

export function readSubtitleSize(): SubtitleSize {
  try {
    const stored = localStorage.getItem(SUBTITLE_SIZE_KEY)
    return isSubtitleSize(stored) ? stored : DEFAULT_SUBTITLE_SIZE
  } catch {
    return DEFAULT_SUBTITLE_SIZE
  }
}

export function writeSubtitleSize(size: string) {
  if (!isSubtitleSize(size)) return

  try {
    localStorage.setItem(SUBTITLE_SIZE_KEY, size)
    window.dispatchEvent(new Event(SUBTITLE_SIZE_EVENT))
  } catch {
    // Keep settings usable when browser storage is unavailable.
  }
}

function subscribeToSubtitleSize(onChange: () => void) {
  window.addEventListener(SUBTITLE_SIZE_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(SUBTITLE_SIZE_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function useSubtitleSize() {
  return useSyncExternalStore(
    subscribeToSubtitleSize,
    readSubtitleSize,
    () => DEFAULT_SUBTITLE_SIZE,
  )
}
