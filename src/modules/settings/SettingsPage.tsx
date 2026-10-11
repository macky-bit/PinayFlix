import { useState, type ReactElement } from "react"

import StreamFlixSelect from "../../components/StreamFlixSelect"

import ToggleSwitch from "../../components/ToggleSwitch"

import { supabase } from "../../lib/supabase"

import { clearContinueWatching } from "../dashboard/continueWatchingStore"

import styles from "./settings.module.css"

interface Props {
  onBack: () => void
}

type Tab = "playback" | "notifications" | "privacy" | "appearance"

const TABS: { id: Tab label: string }[] = [
  { id: "playback", label: "Playback" },

  { id: "notifications", label: "Notifications" },

  { id: "privacy", label: "Privacy" },

  { id: "appearance", label: "Appearance" },
]

function Select({
  value,

  options,

  onChange,

  ariaLabel,
}: {
  value: string

  options: string[]

  onChange: (v: string) => void

  ariaLabel: string
}) {
  return (
    <StreamFlixSelect
      value={value}
      options={options}
      onChange={onChange}
      ariaLabel={ariaLabel}
    />
  )
}

function PlaybackTab() {
  const [autoPlay, setAutoPlay] = useState(true)

  const [autoNextEp, setAutoNextEp] = useState(true)

  const [previewSounds, setPreviewSounds] = useState(false)

  const [quality, setQuality] = useState("Auto")

  const [dataUsage, setDataUsage] = useState("High")

  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Video Playback</h3>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Auto-play next episode</p>
            <p className={styles.settingDesc}>
              Automatically play the next episode in a series.
            </p>
          </div>
          <ToggleSwitch
            checked={autoNextEp}
            onChange={() => setAutoNextEp((v) => !v)}
            ariaLabel="Toggle auto-play next episode"
          />
        </div>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Auto-play previews</p>
            <p className={styles.settingDesc}>Play previews while browsing.</p>
          </div>
          <ToggleSwitch
            checked={autoPlay}
            onChange={() => setAutoPlay((v) => !v)}
            ariaLabel="Toggle auto-play previews"
          />
        </div>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Preview sounds</p>
            <p className={styles.settingDesc}>
              Play audio during title previews.
            </p>
          </div>
          <ToggleSwitch
            checked={previewSounds}
            onChange={() => setPreviewSounds((v) => !v)}
            ariaLabel="Toggle preview sounds"
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Quality & Data</h3>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Streaming quality</p>
            <p className={styles.settingDesc}>
              Choose the default streaming quality.
            </p>
          </div>
          <Select
            value={quality}
            ariaLabel="Streaming quality"
            options={["Auto", "Low", "Medium", "High", "Ultra HD"]}
            onChange={setQuality}
          />
        </div>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Data usage per screen</p>
            <p className={styles.settingDesc}>
              Controls data consumption during streaming.
            </p>
          </div>
          <Select
            value={dataUsage}
            ariaLabel="Data usage per screen"
            options={["Low", "Medium", "High", "Unlimited"]}
            onChange={setDataUsage}
          />
        </div>
      </div>
    </div>
  )
}

function NotificationsTab() {
  const [emailUpdates, setEmailUpdates] = useState(true)

  const [newReleases, setNewReleases] = useState(true)

  const [recommendations, setRecommendations] = useState(false)

  const [accountAlerts, setAccountAlerts] = useState(true)

  const rows = [
    {
      label: "Email updates",

      desc: "Receive news and product updates via email.",

      val: emailUpdates,

      set: setEmailUpdates,
    },

    {
      label: "New releases",

      desc: "Get notified when new titles are added.",

      val: newReleases,

      set: setNewReleases,
    },

    {
      label: "Recommendations",

      desc: "Personalised show and movie suggestions.",

      val: recommendations,

      set: setRecommendations,
    },

    {
      label: "Account alerts",

      desc: "Security and billing notifications.",

      val: accountAlerts,

      set: setAccountAlerts,
    },
  ]

  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Email Notifications</h3>
        {rows.map((r) => (
          <div key={r.label} className={styles.settingRow}>
            <div>
              <p className={styles.settingLabel}>{r.label}</p>
              <p className={styles.settingDesc}>{r.desc}</p>
            </div>
            <ToggleSwitch
              checked={r.val}
              onChange={() => r.set((v: boolean) => !v)}
              ariaLabel={`Toggle ${r.label}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function PrivacyTab() {
  const [watchHistory, setWatchHistory] = useState(true)

  const [searchHistory, setSearchHistory] = useState(true)

  const [personalised, setPersonalised] = useState(true)

  const [clearingHistory, setClearingHistory] = useState(false)

  const [historyMessage, setHistoryMessage] = useState("")

  async function clearHistory() {
    if (clearingHistory) return

    if (!window.confirm("Permanently clear all watch history?")) return

    setClearingHistory(true)

    setHistoryMessage("")

    const { error } = await supabase.rpc("clear_my_watch_history")

    if (error) {
      setHistoryMessage(error.message || "Watch history could not be cleared.")

      setClearingHistory(false)

      return
    }

    clearContinueWatching()

    setHistoryMessage("Watch history cleared.")

    setClearingHistory(false)
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Data & History</h3>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Watch history</p>
            <p className={styles.settingDesc}>
              Allow StreamFlix to track what you watch.
            </p>
          </div>
          <ToggleSwitch
            checked={watchHistory}
            onChange={() => setWatchHistory((v) => !v)}
            ariaLabel="Toggle watch history"
          />
        </div>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Search history</p>
            <p className={styles.settingDesc}>
              Save your recent searches for quick access.
            </p>
          </div>
          <ToggleSwitch
            checked={searchHistory}
            onChange={() => setSearchHistory((v) => !v)}
            ariaLabel="Toggle search history"
          />
        </div>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Personalised recommendations</p>
            <p className={styles.settingDesc}>
              Use your activity to suggest titles.
            </p>
          </div>
          <ToggleSwitch
            checked={personalised}
            onChange={() => setPersonalised((v) => !v)}
            ariaLabel="Toggle personalised recommendations"
          />
        </div>
      </div>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Danger Zone</h3>
        <div className={styles.dangerRow}>
          <div>
            <p className={styles.settingLabel}>Clear watch history</p>
            <p className={styles.settingDesc}>
              Permanently remove all viewing history.
            </p>
          </div>
          <button
            type="button"
            className={styles.dangerBtn}
            onClick={() => void clearHistory()}
            disabled={clearingHistory}
          >
            {clearingHistory ? "Clearing…" : "Clear History"}
          </button>
        </div>
        {historyMessage && (
          <p className={styles.settingDesc} role="status">
            {historyMessage}
          </p>
        )}
      </div>
    </div>
  )
}

function AppearanceTab() {
  const [theme, setTheme] = useState("Dark")

  const [language, setLanguage] = useState("English")

  const [subtitleSize, setSubtitleSize] = useState("Medium")

  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Display</h3>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Theme</p>
            <p className={styles.settingDesc}>
              Choose your preferred interface theme.
            </p>
          </div>
          <Select
            value={theme}
            ariaLabel="Theme"
            options={["Dark", "System"]}
            onChange={setTheme}
          />
        </div>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Language</p>
            <p className={styles.settingDesc}>
              Select your preferred display language.
            </p>
          </div>
          <Select
            value={language}
            ariaLabel="Display language"
            options={["English", "Spanish", "French", "German", "Japanese"]}
            onChange={setLanguage}
          />
        </div>
      </div>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Subtitles</h3>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Subtitle size</p>
            <p className={styles.settingDesc}>
              Adjust the size of subtitles during playback.
            </p>
          </div>
          <Select
            value={subtitleSize}
            ariaLabel="Subtitle size"
            options={["Small", "Medium", "Large", "Extra Large"]}
            onChange={setSubtitleSize}
          />
        </div>
      </div>
    </div>
  )
}

const TAB_CONTENT: Record<Tab, ReactElement> = {
  playback: <PlaybackTab />,

  notifications: <NotificationsTab />,

  privacy: <PrivacyTab />,

  appearance: <AppearanceTab />,
}

export default function SettingsPage({ onBack }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("playback")

  return (
    <div className={styles.page}>
      {/* Back button */}
      <div className={styles.backRow}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to StreamFlix
        </button>
      </div>

      <div className={styles.inner}>
        {/* Page header */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.pageSubtitle}>
            Manage your StreamFlix preferences
          </p>
        </div>

        <div className={styles.layout}>
          {/* Sidebar tabs */}
          <nav className={styles.sidebar} aria-label="Settings sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`${styles.tabBtn} ${
                  activeTab === t.id ? styles.tabBtnActive : ""
                }`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Content panel */}
          <div className={styles.panel}>{TAB_CONTENT[activeTab]}</div>
        </div>
      </div>
    </div>
  )
}
