import type { SupabaseClient } from "@supabase/supabase-js"

export interface SoundtrackTrack {
  id: string
  title: string
  lookupTitle: string
  artist: string
  audioUrl: string
  referenceUrl: string
  timestamp: string
  lyrics: string
  instrumental: boolean
  lyricsSourceUrl: string
}

interface SoundtrackRow {
  soundtrack_id: string | number
  song_title: string
  track_title: string | null
  artist: string | null
  stream_link: string | null
  external_url: string | null
  timestamp_label: string | null
  lyrics: string | null
  lyrics_instrumental: boolean | null
  lyrics_source_url: string | null
}

interface StorageObjectReference {
  bucket: string
  path: string
}

const SPIDER_MAN_SOUNDTRACK_OBJECT: StorageObjectReference = {
  bucket: "stream_link",
  path: "Suite New Day from Spider-Man Brand New Day Soundtrack.mp3",
}

function storageObjectReference(value: string): StorageObjectReference | null {
  if (!value) return null

  if (value.startsWith("supabase://")) {
    const reference = value.slice("supabase://".length)
    const separator = reference.indexOf("/")
    if (separator < 1) return null

    return {
      bucket: decodeURIComponent(reference.slice(0, separator)),
      path: decodeURIComponent(reference.slice(separator + 1)),
    }
  }

  try {
    const url = new URL(value)
    const publicObjectMatch = url.pathname.match(
      /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
    )
    if (publicObjectMatch) {
      return {
        bucket: decodeURIComponent(publicObjectMatch[1]),
        path: decodeURIComponent(publicObjectMatch[2]),
      }
    }

    const dashboardBucketMatch = url.pathname.match(/\/buckets\/([^/]+)$/)
    const previewPath = url.searchParams.get("preview")
    if (dashboardBucketMatch && previewPath) {
      return {
        bucket: decodeURIComponent(dashboardBucketMatch[1]),
        path: previewPath,
      }
    }
  } catch {
    return null
  }

  return null
}

async function playableStorageUrl(
  client: SupabaseClient,
  reference: StorageObjectReference,
) {
  const storage = client.storage.from(reference.bucket)
  const { data, error } = await storage.createSignedUrl(reference.path, 60 * 60)

  if (!error && data?.signedUrl) return data.signedUrl

  return storage.getPublicUrl(reference.path).data.publicUrl
}

export async function loadSoundtracks(
  client: SupabaseClient,
  contentId: number,
): Promise<SoundtrackTrack[]> {
  const { data, error } = await client
    .from("soundtrack")
    .select(
      "soundtrack_id, song_title, track_title, artist, stream_link, external_url, timestamp_label, lyrics, lyrics_instrumental, lyrics_source_url",
    )
    .eq("content_id", contentId)
    .order("soundtrack_id", { ascending: true })

  if (error) throw error

  return Promise.all(
    ((data ?? []) as SoundtrackRow[]).map(async (row) => {
      const storedAudioUrl = row.stream_link?.trim() || ""
      const isSpiderManTrack =
        contentId === 1 && row.song_title.trim().toLowerCase() === "suite new day"
      const storageReference =
        storageObjectReference(storedAudioUrl) ||
        (isSpiderManTrack && !storedAudioUrl
          ? SPIDER_MAN_SOUNDTRACK_OBJECT
          : null)

      return {
        id: String(row.soundtrack_id),
        title: row.track_title?.trim() || row.song_title.trim(),
        lookupTitle: row.song_title.trim(),
        artist: row.artist?.trim() || "Artist unavailable",
        audioUrl: storageReference
          ? await playableStorageUrl(client, storageReference)
          : storedAudioUrl,
        referenceUrl: row.external_url?.trim() || "",
        timestamp: row.timestamp_label?.trim() || "",
        lyrics: row.lyrics?.trim() || "",
        instrumental: row.lyrics_instrumental === true,
        lyricsSourceUrl: row.lyrics_source_url?.trim() || "",
      }
    }),
  )
}
