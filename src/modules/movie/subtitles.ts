import type { SupabaseClient } from "@supabase/supabase-js"

interface SubtitleRow {
  subtitle: string | null

  category: { category_name: string } | { category_name: string }[] | null
}

export interface SubtitleCue {
  start: number

  end: number

  text: string
}

function categoryName(row: SubtitleRow) {
  const category = Array.isArray(row.category) ? row.category[0] : row.category

  return category?.category_name?.trim().toLowerCase() ?? ""
}

export function convertSrtToVtt(source: string) {
  const cleanSource = source.replace(/^\uFEFF/, "").trim()

  if (/^WEBVTT(?:\s|$)/i.test(cleanSource)) return cleanSource

  return `WEBVTT\n\n${cleanSource.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")}`
}

function parseTimestamp(value: string) {
  const match = value.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})$/)

  if (!match) return null

  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(match[4]) / 1000
  )
}

export function parseSubtitleCues(source: string): SubtitleCue[] {
  return source

    .replace(/^\uFEFF/, "")

    .replace(/^WEBVTT[^\n]*\n/i, "")

    .split(/\r?\n\s*\r?\n/)

    .flatMap((block) => {
      const lines = block.split(/\r?\n/)

      const timingIndex = lines.findIndex((line) => line.includes("-->"))

      if (timingIndex < 0) return []

      const [startValue, endValue] = lines[timingIndex].split("-->")

      const start = parseTimestamp(startValue)

      const end = parseTimestamp(endValue.trim().split(/\s/)[0])

      const text = lines
        .slice(timingIndex + 1)
        .join("\n")
        .trim()

      return start === null || end === null || !text
        ? []
        : [{ start, end, text }]
    })
}

export async function loadSubtitleTrack(
  client: SupabaseClient,

  tmdbId: number,

  isSeries: boolean,
) {
  const { data, error } = await client

    .from("content")

    .select("subtitle, category(category_name)")

    .eq("tmdb_id", tmdbId)

    .not("subtitle", "is", null)

    .limit(10)

  if (error) throw error

  const expectedCategory = isSeries ? "tv series" : "movie"

  const content = ((data ?? []) as unknown as SubtitleRow[]).find(
    (row) =>
      categoryName(row) === expectedCategory &&
      typeof row.subtitle === "string" &&
      row.subtitle.trim().length > 0,
  )

  if (!content?.subtitle) return null

  const path = content.subtitle.trim().replace(/^\/+/, "")

  const { data: signedData, error: signedError } = await client.storage

    .from("subtitle")

    .createSignedUrl(path, 60 * 60)

  if (signedError) throw signedError

  if (!signedData.signedUrl) {
    throw new Error("The subtitle file does not have a playable URL.")
  }

  const response = await fetch(signedData.signedUrl)

  if (!response.ok) {
    throw new Error(`Subtitle file could not be loaded (${response.status}).`)
  }

  const cues = parseSubtitleCues(await response.text())

  if (cues.length === 0) {
    throw new Error("The subtitle file does not contain any valid cues.")
  }

  return cues
}
