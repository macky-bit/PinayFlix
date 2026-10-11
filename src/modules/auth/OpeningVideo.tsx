import { useCallback, useEffect, useRef, useState } from "react"

import { supabase } from "../../lib/supabase"
import styles from "./openingVideo.module.css"

const OPENING_VIDEO_BUCKET = "streamflix-media"
const OPENING_VIDEO_PATH = "opening/streamflix-opening-desktop.mp4"
const OPENING_VIDEO_URL = supabase.storage
  .from(OPENING_VIDEO_BUCKET)
  .getPublicUrl(OPENING_VIDEO_PATH).data.publicUrl

export default function OpeningVideo({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const completionTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const finishing = useRef(false)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [muted, setMuted] = useState(false)
  const [needsInteraction, setNeedsInteraction] = useState(false)
  const [playbackError, setPlaybackError] = useState(false)

  const finish = useCallback(() => {
    if (finishing.current) return
    finishing.current = true
    setLeaving(true)
    completionTimer.current = window.setTimeout(onComplete, 380)
  }, [onComplete])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const startPlayback = async () => {
      try {
        video.muted = false
        await video.play()
      } catch {
        try {
          video.muted = true
          setMuted(true)
          await video.play()
        } catch {
          setNeedsInteraction(true)
        }
      }
    }

    void startPlayback()
    return () => {
      if (completionTimer.current) window.clearTimeout(completionTimer.current)
    }
  }, [onComplete])

  const playManually = async () => {
    const video = videoRef.current
    if (!video) return
    try {
      await video.play()
      setNeedsInteraction(false)
    } catch {
      finish()
    }
  }

  const retryPlayback = async () => {
    const video = videoRef.current
    if (!video) return
    setPlaybackError(false)
    setReady(false)
    video.load()
    try {
      video.muted = true
      setMuted(true)
      await video.play()
    } catch {
      setPlaybackError(true)
    }
  }

  const toggleSound = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  return (
    <section
      className={`${styles.opening} ${ready ? styles.ready : ""} ${leaving ? styles.leaving : ""}`}
      aria-label="StreamFlix opening video"
    >
      <div className={styles.loading} aria-hidden="true">
        <span>SF</span>
      </div>
      <video
        ref={videoRef}
        className={styles.video}
        src={OPENING_VIDEO_URL}
        autoPlay
        playsInline
        preload="auto"
        onCanPlay={() => setReady(true)}
        onEnded={finish}
        onError={() => {
          setReady(true)
          setPlaybackError(true)
        }}
      />

      {playbackError && (
        <div className={styles.errorPanel} role="alert">
          <strong>The opening video could not start.</strong>
          <div>
            <button type="button" onClick={() => void retryPlayback()}>Retry video</button>
            <button type="button" onClick={finish}>Continue</button>
          </div>
        </div>
      )}

      {needsInteraction && !playbackError && (
        <button className={styles.startButton} type="button" onClick={() => void playManually()}>
          Play opening
        </button>
      )}

      <div className={styles.actions}>
        <button type="button" onClick={toggleSound} aria-label={muted ? "Enable opening video sound" : "Mute opening video"}>
          {muted ? "Sound on" : "Mute"}
        </button>
        <button type="button" onClick={finish}>Skip</button>
      </div>
    </section>
  )
}
