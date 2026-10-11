import type { SupabaseClient } from "@supabase/supabase-js"

interface SubtitleRow {
  subtitle: string | null
  category: { category_name: string } | { category_name: string }[] | null
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

  const vtt = convertSrtToVtt(await response.text())
  return URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }))
}
