import { useCallback, useEffect, useRef, useState } from "react"

import StreamFlixSelect from "../../components/StreamFlixSelect"

import { supabase } from "../../lib/supabase"

import { useContinueWatching } from "../dashboard/continueWatchingStore"

import styles from "./profile.module.css"

import { MAX_PROFILE_NAME_LENGTH, normalizeProfileName } from "./profileName"

type ProfileIdentity = {
  id: number

  name: string

  avatarPath: string

  avatarUrl: string

  isKids: boolean

  hasPin: boolean

  displayOrder: number

  joinedAt: string | null
}

type MemberProfileRow = {
  member_profile_id: number | string

  profile_name: string

  avatar_image: string | null

  is_kids: boolean

  has_pin: boolean

  display_order: number

  is_entitled: boolean
}

type ProfilePreferences = {
  language: string

  maturity: string
}

type AvatarOption = {
  path: string

  url: string
}

const PROFILE_PREFERENCES_KEY = "sf_profile_preferences_v1"

const DEFAULT_PROFILE_PREFERENCES: ProfilePreferences = {
  language: "English",

  maturity: "All Maturity Ratings",
}

function readProfilePreferences(profileId: number): ProfilePreferences {
  try {
    const stored = JSON.parse(
      localStorage.getItem(PROFILE_PREFERENCES_KEY) ?? "{}",
    ) as Record<string, Partial<ProfilePreferences>>

    return {
      language:
        stored[profileId]?.language ?? DEFAULT_PROFILE_PREFERENCES.language,

      maturity:
        stored[profileId]?.maturity ?? DEFAULT_PROFILE_PREFERENCES.maturity,
    }
  } catch {
    return DEFAULT_PROFILE_PREFERENCES
  }
}

function writeProfilePreferences(
  profileId: number,

  preferences: ProfilePreferences,
) {
  const stored = (() => {
    try {
      return JSON.parse(
        localStorage.getItem(PROFILE_PREFERENCES_KEY) ?? "{}",
      ) as Record<string, ProfilePreferences>
    } catch {
      return {}
    }
  })()

  localStorage.setItem(
    PROFILE_PREFERENCES_KEY,

    JSON.stringify({ ...stored, [profileId]: preferences }),
  )
}

const isExternalAvatar = (value: string) =>
  /^(https?:|data:|blob:)/i.test(value)

function initialsFor(name: string) {
  return (
    name

      .trim()

      .split(/\s+/)

      .map((part) => part[0])

      .join("")

      .slice(0, 2)

      .toUpperCase() || "SF"
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────

function ChevronDownIcon({
  size = 16,

  className = "",
}: {
  size?: number

  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function ChevronRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function InfoIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function MoreVertIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  )
}

function ShieldIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function GlobeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function ClockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function LockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function XIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function EditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

// ── Toggle ─────────────────────────────────────────────────────────────────

// ── SelectDropdown ─────────────────────────────────────────────────────────

function SelectDropdown({
  value,

  options,

  onChange,

  ariaLabel = "Select option",
}: {
  value: string

  options: string[]

  onChange: (v: string) => void

  ariaLabel?: string
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

// ── Avatar ─────────────────────────────────────────────────────────────────

function Avatar({
  initials,

  imageUrl,

  size = "sm",
}: {
  initials: string

  imageUrl?: string

  size?: "sm" | "lg"
}) {
  const sizeClass = size === "lg" ? "w-20 h-20 text-2xl" : "w-9 h-9 text-sm"

  return (
    <div
      className={`${sizeClass} relative overflow-hidden bg-[var(--color-wine)] text-[var(--color-cream)] font-display font-bold flex items-center justify-center rounded-sm flex-shrink-0`}
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",

        letterSpacing: "0.05em",
      }}
    >
      {initials}
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
        />
      )}
    </div>
  )
}

// ── EditProfileModal ───────────────────────────────────────────────────────

function EditProfileModal({
  profile,

  onClose,

  onSaved,
}: {
  profile: ProfileIdentity

  onClose: () => void

  onSaved: (
    name: string,
    preferences: ProfilePreferences,
    avatar: AvatarOption,
  ) => void
}) {
  const [name, setName] = useState(profile.name)

  const initialPreferences = useRef(readProfilePreferences(profile.id)).current

  const [lang, setLang] = useState(initialPreferences.language)

  const [maturity, setMaturity] = useState(initialPreferences.maturity)

  const [saving, setSaving] = useState(false)

  const [saveError, setSaveError] = useState("")

  const [avatarPath, setAvatarPath] = useState(profile.avatarPath)

  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)

  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)

  const [avatarOptions, setAvatarOptions] = useState<AvatarOption[]>([])

  const [avatarsLoading, setAvatarsLoading] = useState(false)

  const [avatarError, setAvatarError] = useState("")

  const hasChanges =
    name.trim() !== profile.name ||
    lang !== initialPreferences.language ||
    maturity !== initialPreferences.maturity ||
    avatarPath !== profile.avatarPath

  const openAvatarPicker = async () => {
    setAvatarPickerOpen(true)
    setAvatarError("")

    if (avatarOptions.length || avatarsLoading) return

    setAvatarsLoading(true)

    const { data: files, error: listError } = await supabase.storage
      .from("avatar")
      .list("", { limit: 50, sortBy: { column: "name", order: "asc" } })

    if (listError) {
      setAvatarError("Profile avatars could not be loaded. Please try again.")
      setAvatarsLoading(false)
      return
    }

    const avatarFiles = (files ?? []).filter((file) => file.id)
    const paths = avatarFiles.map((file) => file.name)
    const { data: signedAvatars, error: signedUrlError } =
      await supabase.storage.from("avatar").createSignedUrls(paths, 60 * 60)

    if (signedUrlError) {
      setAvatarError("Profile avatars could not be loaded. Please try again.")
      setAvatarsLoading(false)
      return
    }

    const signedUrls = new Map(
      (signedAvatars ?? [])
        .filter((avatar) => avatar.signedUrl)
        .map((avatar) => [avatar.path, avatar.signedUrl]),
    )

    const options = avatarFiles
      .map((file) => ({
        path: file.name,
        url: signedUrls.get(file.name) ?? "",
      }))
      .filter((avatar) => avatar.url)

    setAvatarOptions(options)
    setAvatarsLoading(false)

    if (!options.length) {
      setAvatarError("No profile avatars are currently available.")
    }
  }

  const handleSave = async () => {
    setSaveError("")

    let normalizedName: string

    try {
      normalizedName = normalizeProfileName(name)
    } catch (reason) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : "Enter a valid profile name.",
      )

      return
    }

    setSaving(true)

    const { error } =
      avatarPath !== profile.avatarPath
        ? await supabase.rpc("update_my_member_profile", {
            selected_profile_id: profile.id,

            selected_profile_name: normalizedName,

            selected_avatar_path: avatarPath,

            selected_pin: null,

            remove_pin: false,
          })
        : normalizedName !== profile.name
          ? await supabase.rpc("rename_my_member_profile", {
            selected_profile_id: profile.id,

            selected_profile_name: normalizedName,
          })
          : { error: null }

    if (error) {
      setSaveError(
        error.code === "23505"
          ? "Another profile already uses this name."
          : error.message || "We couldn't update the profile name.",
      )

      setSaving(false)

      return
    }

    writeProfilePreferences(profile.id, { language: lang, maturity })

    setSaving(false)

    onSaved(
      normalizedName,
      { language: lang, maturity },
      { path: avatarPath, url: avatarUrl },
    )
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "var(--color-ink)" }}
    >
      <div
        className="w-full max-w-md rounded-sm p-7 relative"
        style={{
          background: "var(--color-ink-soft)",

          border: "1px solid var(--color-stone)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-[var(--color-cream)] font-display font-bold text-xl tracking-wide uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Edit Profile
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-taupe)] hover:text-[var(--color-cream)] transition-colors p-1"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <Avatar
            initials={initialsFor(name)}
            imageUrl={avatarUrl}
            size="lg"
          />
          <button
            type="button"
            onClick={() => void openAvatarPicker()}
            disabled={saving}
            aria-expanded={avatarPickerOpen}
            aria-haspopup="dialog"
            className="text-sm text-[var(--color-taupe)] hover:text-[var(--color-cream)] border border-[var(--color-stone)] hover:border-[var(--color-taupe)] px-3 py-1.5 rounded-sm transition-colors"
            style={{ fontFamily: "'Barlow', sans-serif" }}
          >
            Change Avatar
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              className="block text-xs text-[var(--color-taupe)] mb-1.5 uppercase tracking-wider"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Profile Name
            </label>
            <input
              value={name}
              maxLength={MAX_PROFILE_NAME_LENGTH}
              disabled={saving}
              onChange={(e) => {
                setName(e.target.value)

                setSaveError("")
              }}
              className="w-full bg-transparent border border-[var(--color-stone)] text-[var(--color-cream)] px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[var(--color-wine)]"
              style={{ fontFamily: "'Barlow', sans-serif" }}
            />
            <p
              className="mt-1 text-right text-xs text-[var(--color-taupe)]"
              aria-live="polite"
            >
              {name.length}/{MAX_PROFILE_NAME_LENGTH}
            </p>
          </div>

          <div>
            <label
              className="block text-xs text-[var(--color-taupe)] mb-1.5 uppercase tracking-wider"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Default Language
            </label>
            <StreamFlixSelect
              value={lang}
              onChange={setLang}
              ariaLabel="Default language"
              fullWidth
              options={[
                "English",

                "Spanish",

                "French",

                "Japanese",

                "Korean",

                "Portuguese",
              ]}
            />
          </div>

          {!profile.isKids && (
            <div>
              <label
                className="block text-xs text-[var(--color-taupe)] mb-1.5 uppercase tracking-wider"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Maturity Rating
              </label>
              <StreamFlixSelect
                value={maturity}
                onChange={setMaturity}
                ariaLabel="Maturity rating"
                fullWidth
                options={[
                  "All Maturity Ratings",

                  "18+",

                  "16+",

                  "13+",

                  "7+",

                  "All Ages",
                ]}
              />
            </div>
          )}
        </div>

        {saveError && (
          <p role="alert" className="mt-4 text-sm text-[#ff8a8a]">
            {saveError}
          </p>
        )}

        <div className="flex gap-3 mt-7">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 border border-[var(--color-stone)] text-[var(--color-cream)] text-sm rounded-sm hover:border-[var(--color-taupe)] transition-colors"
            style={{ fontFamily: "'Barlow', sans-serif" }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={
              saving ||
              !name.trim() ||
              !hasChanges
            }
            className="flex-1 py-2.5 bg-[var(--color-wine)] text-[var(--color-cream)] text-sm rounded-sm hover:bg-[var(--color-ink-soft)] transition-colors"
            style={{ fontFamily: "'Barlow', sans-serif" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {avatarPickerOpen && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            style={{ background: "rgba(8, 5, 15, 0.82)" }}
            role="presentation"
            onMouseDown={() => setAvatarPickerOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-sm p-6 shadow-2xl"
              style={{
                background: "var(--color-ink-soft)",
                border: "1px solid var(--color-stone)",
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="choose-avatar-title"
              aria-busy={avatarsLoading}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3
                    id="choose-avatar-title"
                    className="text-lg font-bold uppercase tracking-wide text-[var(--color-cream)]"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    Choose an avatar
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-taupe)]">
                    Select an image for this profile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarPickerOpen(false)}
                  className="p-1 text-[var(--color-taupe)] transition-colors hover:text-[var(--color-cream)]"
                  aria-label="Close avatar picker"
                >
                  <XIcon />
                </button>
              </div>

              {avatarsLoading && (
                <p className="py-6 text-center text-sm text-[var(--color-taupe)]">
                  Loading avatars…
                </p>
              )}

              {!!avatarOptions.length && (
                <div className="grid max-h-[55vh] grid-cols-4 gap-3 overflow-y-auto p-1 sm:grid-cols-5">
                  {avatarOptions.map((avatar, index) => (
                    <button
                      key={avatar.path}
                      type="button"
                      onClick={() => {
                        setAvatarPath(avatar.path)
                        setAvatarUrl(avatar.url)
                        setSaveError("")
                        setAvatarPickerOpen(false)
                      }}
                      disabled={saving}
                      aria-label={`Choose avatar ${index + 1}`}
                      aria-pressed={avatarPath === avatar.path}
                      className="aspect-square w-full overflow-hidden rounded-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--color-wine)]"
                      style={{
                        border:
                          avatarPath === avatar.path
                            ? "3px solid var(--color-wine)"
                            : "1px solid var(--color-stone)",
                      }}
                    >
                      <img
                        src={avatar.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {avatarError && (
                <div className="py-4 text-center">
                  <p role="alert" className="text-sm text-[#ff8a8a]">
                    {avatarError}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarOptions([])
                      void openAvatarPicker()
                    }}
                    className="mt-3 text-sm font-semibold text-[var(--color-cream)] underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PINModal ───────────────────────────────────────────────────────────────

function PINModal({
  profileId,

  hasPin,

  onClose,

  onSaved,
}: {
  profileId: number

  hasPin: boolean

  onClose: () => void

  onSaved: (hasPin: boolean) => void
}) {
  const [pin, setPin] = useState("")

  const [confirm, setConfirm] = useState("")

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  async function savePin(selectedPin: string | null) {
    if (saving) return

    setSaving(true)

    setError("")

    const { error: saveError } = await supabase.rpc(
      "set_my_member_profile_pin",

      {
        selected_profile_id: profileId,

        selected_pin: selectedPin,
      },
    )

    if (saveError) {
      setError(saveError.message || "The profile PIN could not be saved.")

      setSaving(false)

      return
    }

    setSaving(false)

    onSaved(selectedPin !== null)
  }

  function handleSave() {
    if (pin.length === 4 && pin === confirm) void savePin(pin)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "var(--color-ink)" }}
    >
      <div
        className="w-full max-w-sm rounded-sm p-7 relative"
        style={{
          background: "var(--color-ink-soft)",

          border: "1px solid var(--color-stone)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-[var(--color-cream)] font-display font-bold text-xl tracking-wide uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {hasPin ? "Change PIN" : "Set PIN"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close profile PIN settings"
            className="text-[var(--color-taupe)] hover:text-[var(--color-cream)] transition-colors p-1"
          >
            <XIcon />
          </button>
        </div>
        <p
          className="text-[var(--color-taupe)] text-sm mb-5"
          style={{ fontFamily: "'Barlow', sans-serif" }}
        >
          Require a PIN to access this profile.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="profile-pin"
              className="block text-xs text-[var(--color-taupe)] mb-1.5 uppercase tracking-wider"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              4-Digit PIN
            </label>
            <input
              id="profile-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              autoComplete="new-password"
              maxLength={4}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="••••"
              className="w-full bg-transparent border border-[var(--color-stone)] text-[var(--color-cream)] px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[var(--color-wine)] tracking-[0.4em]"
              style={{ fontFamily: "'Barlow', sans-serif" }}
            />
          </div>
          <div>
            <label
              htmlFor="profile-pin-confirm"
              className="block text-xs text-[var(--color-taupe)] mb-1.5 uppercase tracking-wider"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Confirm PIN
            </label>
            <input
              id="profile-pin-confirm"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              autoComplete="new-password"
              maxLength={4}
              value={confirm}
              onChange={(e) =>
                setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="••••"
              className="w-full bg-transparent border border-[var(--color-stone)] text-[var(--color-cream)] px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[var(--color-wine)] tracking-[0.4em]"
              style={{ fontFamily: "'Barlow', sans-serif" }}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-red-400 text-sm mt-3">
            {error}
          </p>
        )}
        {pin.length === 4 && confirm.length === 4 && pin !== confirm && (
          <p
            className="text-red-400 text-sm mt-3"
            style={{ fontFamily: "'Barlow', sans-serif" }}
          >
            PINs do not match.
          </p>
        )}

        <div className="flex gap-3 mt-7">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 border border-[var(--color-stone)] text-[var(--color-cream)] text-sm rounded-sm hover:border-[var(--color-taupe)] transition-colors"
            style={{ fontFamily: "'Barlow', sans-serif" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving ||
              pin.length !== 4 ||
              confirm.length !== 4 ||
              pin !== confirm
            }
            className="flex-1 py-2.5 bg-[var(--color-wine)] text-[var(--color-cream)] text-sm rounded-sm hover:bg-[var(--color-ink-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Barlow', sans-serif" }}
          >
            {saving ? "Saving…" : "Save PIN"}
          </button>
        </div>
        {hasPin && (
          <button
            type="button"
            onClick={() => void savePin(null)}
            disabled={saving}
            className="mt-4 w-full py-2 text-sm text-red-300 hover:text-red-200 disabled:opacity-40"
          >
            Remove PIN
          </button>
        )}
      </div>
    </div>
  )
}

// ── WatchHistoryPanel ──────────────────────────────────────────────────────

function DeleteProfileModal({
  profile,

  onClose,

  onDeleted,
}: {
  profile: ProfileIdentity

  onClose: () => void

  onDeleted: () => void
}) {
  const [confirmation, setConfirmation] = useState("")

  const [deleting, setDeleting] = useState(false)

  const [error, setError] = useState("")

  const canDelete =
    confirmation.trim().toLocaleLowerCase() ===
    profile.name.trim().toLocaleLowerCase()

  const handleDelete = async () => {
    if (!canDelete || deleting) return

    setDeleting(true)

    setError("")

    const { error: deleteError } = await supabase.rpc(
      "delete_my_member_profile",

      { selected_profile_id: profile.id },
    )

    if (deleteError) {
      setError(
        deleteError.message.includes("At least one profile is required")
          ? "You cannot delete the only profile on your account. Create another profile first."
          : deleteError.message || "The profile could not be deleted.",
      )

      setDeleting(false)

      return
    }

    window.dispatchEvent(
      new CustomEvent("streamflix:profile-deleted", {
        detail: { profileId: profile.id },
      }),
    )

    onDeleted()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(8, 5, 16, 0.92)" }}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-profile-title"
        aria-describedby="delete-profile-description"
        className="w-full max-w-md rounded-sm p-7"
        style={{
          background: "var(--color-ink-soft)",

          border: "1px solid rgba(248, 113, 113, 0.55)",
        }}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2
            id="delete-profile-title"
            className="text-xl font-bold uppercase tracking-wide text-[var(--color-cream)]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Delete Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            aria-label="Close delete profile confirmation"
            className="p-1 text-[var(--color-taupe)] transition-colors hover:text-[var(--color-cream)] disabled:opacity-40"
          >
            <XIcon />
          </button>
        </div>

        <p
          id="delete-profile-description"
          className="text-sm leading-relaxed text-[var(--color-taupe)]"
        >
          This removes{" "}
          <strong className="text-[var(--color-cream)]">{profile.name}</strong>{" "}
          from your profile picker. Watch history and profile preferences will
          no longer be available.
        </p>
        <label
          htmlFor="delete-profile-confirmation"
          className="mt-5 block text-xs uppercase tracking-wider text-[var(--color-taupe)]"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          Enter the profile name below to confirm:{" "}
          <strong className="text-[var(--color-cream)]">{profile.name}</strong>
        </label>
        <input
          id="delete-profile-confirmation"
          autoFocus
          value={confirmation}
          placeholder={profile.name}
          disabled={deleting}
          onChange={(event) => {
            setConfirmation(event.target.value)

            setError("")
          }}
          className="mt-2 w-full rounded-sm border border-[var(--color-stone)] bg-transparent px-3 py-2 text-sm text-[var(--color-cream)] outline-none focus:border-red-400"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 rounded-sm border border-[var(--color-stone)] py-2.5 text-sm text-[var(--color-cream)] transition-colors hover:border-[var(--color-taupe)] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!canDelete || deleting}
            className="flex-1 rounded-sm border border-red-500 bg-red-950/40 py-2.5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? "Deleting…" : "Delete Profile"}
          </button>
        </div>
      </div>
    </div>
  )
}

type WatchHistoryRow = {
  content_id: number | string

  title: string

  thumbnail: string | null

  watch_date: string

  last_playback: number | null

  runtime: number | null
}

type WatchHistoryItem = {
  key: string

  contentId: number | null

  continueId: number | null

  mediaType?: "movie" | "tv"

  title: string

  subtitle: string

  date: string

  img: string

  updatedAt: number
}

function formatPlaybackTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))

  const hours = Math.floor(safeSeconds / 3600)

  const minutes = Math.floor((safeSeconds % 3600) / 60)

  const remainingSeconds = safeSeconds % 60

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

function WatchHistoryPanel({
  onClose,
  profileId,
}: {
  onClose: () => void
  profileId: number
}) {
  const [items, setItems] = useState<WatchHistoryItem[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const {
    entries: continueEntries,

    remove: removeContinueEntry,
  } = useContinueWatching(null, profileId)

  const loadHistory = useCallback(async () => {
    setLoading(true)

    setError("")

    const { data, error: historyError } = await supabase.rpc(
      "get_my_watch_history",
      { selected_profile_id: profileId },
    )

    if (historyError) throw historyError

    const rows = (data ?? []) as WatchHistoryRow[]

    setItems(
      rows.map((row) => ({
        key: `history:${row.content_id}`,

        contentId: Number(row.content_id),

        continueId: null,

        title: row.title,

        subtitle: `${formatPlaybackTime(row.last_playback ?? 0)} watched${
          row.runtime ? ` · ${row.runtime} min` : ""
        }`,

        date: new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",

          timeStyle: "short",
        }).format(new Date(row.watch_date)),

        img: row.thumbnail?.trim() ?? "",

        updatedAt: new Date(row.watch_date).getTime(),
      })),
    )

    setLoading(false)
  }, [profileId])

  useEffect(() => {
    void loadHistory().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Watch history could not be loaded.",
      )

      setLoading(false)
    })
  }, [loadHistory])

  const removeHistoryItem = async (item: WatchHistoryItem) => {
    if (item.continueId !== null) {
      removeContinueEntry(item.continueId, item.mediaType)
    }

    if (item.contentId === null) return

    const { error: removeError } = await supabase.rpc(
      "delete_my_watch_history_entry",

      { selected_content_id: item.contentId, selected_profile_id: profileId },
    )

    if (removeError) {
      setError(removeError.message)

      return
    }

    setItems((current) =>
      current.filter((entry) => entry.contentId !== item.contentId),
    )
  }

  const remoteItemsByTitle = new Map(
    items.map((item) => [item.title.trim().toLocaleLowerCase(), item]),
  )

  const continueItems: WatchHistoryItem[] = continueEntries.map((entry) => {
    const titleKey = entry.show.title.trim().toLocaleLowerCase()

    const remoteItem = remoteItemsByTitle.get(titleKey)

    const progress = Math.max(0, Math.min(100, Math.round(entry.progress)))

    return {
      key: `continue:${entry.show.mediaType ?? "movie"}:${entry.show.id}`,

      contentId: remoteItem?.contentId ?? null,

      continueId: entry.show.id,

      mediaType: entry.show.mediaType,

      title: entry.show.title,

      subtitle: `${
        entry.episodeLabel ? `${entry.episodeLabel} · ` : ""
      }${progress}% watched`,

      date: new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",

        timeStyle: "short",
      }).format(new Date(entry.updatedAt)),

      img: entry.show.image,

      updatedAt: entry.updatedAt,
    }
  })

  const continueTitles = new Set(
    continueItems.map((item) => item.title.trim().toLocaleLowerCase()),
  )

  const visibleItems = [...continueItems, ...items].filter(
    (item, index, combined) =>
      !(
        item.continueId === null &&
        continueTitles.has(item.title.trim().toLocaleLowerCase())
      ) &&
      combined.findIndex((candidate) => candidate.key === item.key) === index,
  )

  visibleItems.sort((first, second) => second.updatedAt - first.updatedAt)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "var(--color-ink)" }}
    >
      <div
        className="w-full max-w-lg rounded-sm p-7 relative"
        style={{
          background: "var(--color-ink-soft)",

          border: "1px solid var(--color-stone)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-[var(--color-cream)] font-display font-bold text-xl tracking-wide uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Watch History
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-taupe)] hover:text-[var(--color-cream)] transition-colors p-1"
          >
            <XIcon />
          </button>
        </div>

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {loading && (
            <p
              className="text-[var(--color-taupe)] text-sm py-4 text-center"
              style={{ fontFamily: "'Barlow', sans-serif" }}
            >
              Loading watch history…
            </p>
          )}
          {!loading && error && (
            <div className="py-4 text-center">
              <p
                role="alert"
                className="text-red-300 text-sm"
                style={{ fontFamily: "'Barlow', sans-serif" }}
              >
                {error}
              </p>
              <button
                type="button"
                onClick={() => void loadHistory()}
                className="mt-3 text-sm text-[var(--color-cream)] underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          )}
          {!loading && !error && visibleItems.length === 0 && (
            <p
              className="text-[var(--color-taupe)] text-sm py-4 text-center"
              style={{ fontFamily: "'Barlow', sans-serif" }}
            >
              No watch history.
            </p>
          )}
          {visibleItems.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-3 py-3 group"
              style={{ borderBottom: "1px solid var(--color-stone)" }}
            >
              {item.img ? (
                <img
                  src={item.img}
                  alt=""
                  className="w-20 h-12 object-cover rounded-sm flex-shrink-0"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="w-20 h-12 rounded-sm flex-shrink-0 bg-[var(--color-stone)] flex items-center justify-center text-[var(--color-taupe)]"
                >
                  <PlayIcon size={16} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p
                  className="text-[var(--color-cream)] text-sm font-medium truncate"
                  style={{ fontFamily: "'Barlow', sans-serif" }}
                >
                  {item.title}
                </p>
                <p
                  className="text-[var(--color-taupe)] text-xs"
                  style={{ fontFamily: "'Barlow', sans-serif" }}
                >
                  {item.subtitle}
                </p>
                <p
                  className="text-[var(--color-stone)] text-xs mt-0.5"
                  style={{ fontFamily: "'Barlow', sans-serif" }}
                >
                  {item.date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void removeHistoryItem(item)}
                className="text-[var(--color-stone)] hover:text-[var(--color-taupe)] transition-colors p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label={`Remove ${item.title} from watch history`}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-2.5 border border-[var(--color-stone)] text-[var(--color-cream)] text-sm rounded-sm hover:border-[var(--color-taupe)] transition-colors"
          style={{ fontFamily: "'Barlow', sans-serif" }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ── ManageProfilesModal ────────────────────────────────────────────────────

function ManageProfilesModal({
  activeProfileId,

  onClose,

  onActiveProfileDeleted,
}: {
  activeProfileId: number | null

  onClose: () => void

  onActiveProfileDeleted: () => void
}) {
  const [profiles, setProfiles] = useState<MemberProfileRow[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const [profileToDelete, setProfileToDelete] =
    useState<ProfileIdentity | null>(null)

  const loadProfiles = useCallback(async () => {
    setLoading(true)

    setError("")

    const { data, error: profilesError } = await supabase.rpc(
      "get_my_member_profiles",
    )

    if (profilesError) {
      setError(profilesError.message || "Profiles could not be loaded.")

      setLoading(false)

      return
    }

    setProfiles((data ?? []) as MemberProfileRow[])

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  const identityFor = (profile: MemberProfileRow): ProfileIdentity => ({
    id: Number(profile.member_profile_id),

    name: profile.profile_name,

    avatarPath: profile.avatar_image?.trim() ?? "",

    avatarUrl: "",

    isKids: profile.is_kids,

    hasPin: profile.has_pin,

    displayOrder: profile.display_order,

    joinedAt: null,
  })

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "var(--color-ink)" }}
    >
      <div
        className="w-full max-w-md rounded-sm p-7 relative"
        style={{
          background: "var(--color-ink-soft)",

          border: "1px solid var(--color-stone)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-[var(--color-cream)] font-display font-bold text-xl tracking-wide uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Manage Profiles
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-taupe)] hover:text-[var(--color-cream)] transition-colors p-1"
          >
            <XIcon />
          </button>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-[var(--color-taupe)]">
          Profiles outside your current plan limit cannot be selected. You can
          delete them here to bring the account within its new limit.
        </p>

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mb-5 max-h-[50vh] space-y-1 overflow-y-auto pr-1">
          {loading && (
            <p className="py-4 text-sm text-[var(--color-taupe)]">
              Loading profiles…
            </p>
          )}
          {profiles.map((p) => (
            <div
              key={p.member_profile_id}
              className="flex items-center gap-3 rounded-sm px-2 py-2.5"
              style={{ borderBottom: "1px solid var(--color-stone)" }}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm bg-[var(--color-wine)] text-sm font-bold text-[var(--color-cream)] ${
                  p.is_entitled ? "" : "grayscale opacity-50"
                }`}
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {initialsFor(p.profile_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm text-[var(--color-cream)]"
                  style={{ fontFamily: "'Barlow', sans-serif" }}
                >
                  {p.profile_name}
                </p>
                <p className="text-xs text-[var(--color-taupe)]">
                  {p.is_entitled
                    ? Number(p.member_profile_id) === activeProfileId
                      ? "Current profile"
                      : "Available"
                    : "Disabled by current plan"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProfileToDelete(identityFor(p))}
                className="rounded-sm p-2 text-red-300 transition-colors hover:bg-red-950/40 hover:text-red-200"
                aria-label={`Delete ${p.profile_name}`}
              >
                <TrashIcon size={17} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 border border-[var(--color-stone)] text-[var(--color-cream)] text-sm rounded-sm hover:border-[var(--color-taupe)] transition-colors"
          style={{ fontFamily: "'Barlow', sans-serif" }}
        >
          Done
        </button>
      </div>

      {profileToDelete && (
        <DeleteProfileModal
          profile={profileToDelete}
          onClose={() => setProfileToDelete(null)}
          onDeleted={() => {
            const deletedActiveProfile = profileToDelete.id === activeProfileId

            setProfileToDelete(null)

            if (deletedActiveProfile) {
              onActiveProfileDeleted()

              return
            }

            void loadProfiles()
          }}
        />
      )}
    </div>
  )
}

// ── ContinueWatchingCard ───────────────────────────────────────────────────

interface CardData {
  id: number

  title: string

  img: string

  progress: number
}

function ContinueWatchingCard({
  card,

  onRemove,
}: {
  card: CardData

  onRemove: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false)
    }

    if (menuOpen) document.addEventListener("mousedown", handleClick)

    return () => document.removeEventListener("mousedown", handleClick)
  }, [menuOpen])

  return (
    <div
      className={`${styles.cardHover} relative rounded-sm overflow-hidden flex-shrink-0 transition-transform duration-200 cursor-pointer`}
      style={{ width: "clamp(200px, 22vw, 320px)", aspectRatio: "16/9" }}
    >
      <img
        src={card.img}
        alt={card.title}
        className="w-full h-full object-cover"
      />

      {/* Dark gradient overlay at bottom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, var(--color-ink) 0%, var(--color-ink) 50%, transparent 100%)",
        }}
      />

      {/* Hover overlay */}
      <div
        className={`${styles.cardOverlay} absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-200`}
        style={{ background: "var(--color-ink)" }}
      >
        <button
          className="bg-[var(--color-cream)] text-[var(--color-ink)] rounded-full p-2 hover:bg-[var(--color-taupe)] transition-colors"
          aria-label={`Play ${card.title}`}
        >
          <PlayIcon size={16} />
        </button>
        <button
          className="border border-[var(--color-cream)] text-[var(--color-cream)] rounded-full p-2 hover:border-[var(--color-cream)] transition-colors"
          aria-label={`More info about ${card.title}`}
        >
          <InfoIcon size={16} />
        </button>
      </div>

      {/* Title + progress */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 pt-6">
        <p
          className="text-[var(--color-cream)] text-sm font-medium mb-2 truncate"
          style={{ fontFamily: "'Barlow', sans-serif" }}
        >
          {card.title}
        </p>
        <div
          className="w-full h-0.5 rounded-full"
          style={{ background: "var(--color-stone)" }}
        >
          <div
            className="h-full rounded-full bg-[var(--color-wine)]"
            style={{ width: `${card.progress}%` }}
          />
        </div>
      </div>

      {/* Three-dot menu */}
      <div className="absolute top-2 right-2" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation()

            setMenuOpen((v) => !v)
          }}
          className="text-[var(--color-taupe)] hover:text-[var(--color-cream)] p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-all"
          style={{ background: "var(--color-ink)" }}
          aria-label="More options"
        >
          <MoreVertIcon />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-7 w-48 rounded-sm shadow-xl py-1 z-20"
            style={{
              background: "var(--color-ink-soft)",

              border: "1px solid var(--color-stone)",
            }}
          >
            <button
              onClick={() => {
                setMenuOpen(false)

                onRemove()
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-taupe)] hover:text-[var(--color-cream)] hover:bg-[var(--color-wine)] transition-colors"
              style={{ fontFamily: "'Barlow', sans-serif" }}
            >
              Remove from Continue Watching
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SettingRow ─────────────────────────────────────────────────────────────

function SettingRow({
  icon,

  label,

  description,

  control,

  last = false,
}: {
  icon: React.ReactNode

  label: string

  description: string

  control: React.ReactNode

  last?: boolean
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-4 py-4 sm:flex-nowrap ${
        !last ? "border-b border-[var(--color-stone)]" : ""
      }`}
    >
      <div className="text-[var(--color-taupe)] flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[var(--color-cream)] text-sm font-medium"
          style={{ fontFamily: "'Barlow', sans-serif" }}
        >
          {label}
        </p>
        <p
          className="text-[var(--color-taupe)] text-xs mt-0.5 leading-relaxed"
          style={{ fontFamily: "'Barlow', sans-serif" }}
        >
          {description}
        </p>
      </div>
      <div className="w-full pl-10 sm:w-auto sm:pl-0 sm:flex-shrink-0">
        {control}
      </div>
    </div>
  )
}

// ── RightPanelRow ──────────────────────────────────────────────────────────

function RightPanelRow({
  icon,

  label,

  description,

  onClick,

  last = false,
}: {
  icon: React.ReactNode

  label: string

  description: string

  onClick: () => void

  last?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.interactiveRow} ${
        !last ? "border-b border-[var(--color-stone)]" : ""
      }`}
    >
      <div className={styles.interactiveRowIcon}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[var(--color-cream)] text-sm font-medium"
          style={{ fontFamily: "'Barlow', sans-serif" }}
        >
          {label}
        </p>
        <p
          className="text-[var(--color-taupe)] text-xs mt-0.5 leading-relaxed"
          style={{ fontFamily: "'Barlow', sans-serif" }}
        >
          {description}
        </p>
      </div>
      <span className={styles.interactiveRowChevron}>
        <ChevronRightIcon size={16} />
      </span>
    </button>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────

const INITIAL_CARDS: CardData[] = []

export function ProfileView({
  activeProfileId,

  onProfileDeleted,
}: {
  activeProfileId: number | null

  onProfileDeleted: () => void
}) {
  const [profileIdentity, setProfileIdentity] =
    useState<ProfileIdentity | null>(null)

  const [identityLoading, setIdentityLoading] = useState(true)

  const [identityError, setIdentityError] = useState("")

  const loadProfileIdentity = useCallback(async () => {
    setIdentityLoading(true)

    setIdentityError("")

    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError) throw authError

    if (!authData.user)
      throw new Error("You must be signed in to view this profile.")

    const [profilesResult, accountResult] = await Promise.all([
      supabase.rpc("get_my_member_profiles"),

      supabase

        .from("user")

        .select("joined_at")

        .eq("auth_user_id", authData.user.id)

        .maybeSingle(),
    ])

    if (profilesResult.error) throw profilesResult.error

    if (accountResult.error) throw accountResult.error

    const rows = (profilesResult.data ?? []) as MemberProfileRow[]

    const selectedRow =
      rows.find((row) => Number(row.member_profile_id) === activeProfileId) ??
      rows[0] ??
      null

    if (!selectedRow) {
      setProfileIdentity(null)

      setIdentityLoading(false)

      return
    }

    const avatarPath = selectedRow.avatar_image?.trim() ?? ""

    let avatarUrl = isExternalAvatar(avatarPath) ? avatarPath : ""

    if (avatarPath && !avatarUrl) {
      const { data: avatarData } = await supabase.storage

        .from("avatar")

        .createSignedUrl(avatarPath, 60 * 60)

      avatarUrl = avatarData?.signedUrl ?? ""
    }

    setProfileIdentity({
      id: Number(selectedRow.member_profile_id),

      name: selectedRow.profile_name,

      avatarPath,

      avatarUrl,

      isKids: selectedRow.is_kids,

      hasPin: selectedRow.has_pin,

      displayOrder: selectedRow.display_order,

      joinedAt: accountResult.data?.joined_at
        ? String(accountResult.data.joined_at)
        : null,
    })

    setIdentityLoading(false)
  }, [activeProfileId])

  useEffect(() => {
    void loadProfileIdentity().catch((error: unknown) => {
      setIdentityError(
        error instanceof Error
          ? error.message
          : "Profile identity could not be loaded.",
      )

      setIdentityLoading(false)
    })
  }, [loadProfileIdentity])

  // Settings state

  const [maturity, setMaturity] = useState("All Maturity Ratings")

  const [language, setLanguage] = useState("English")

  const [dirty, setDirty] = useState(false)

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profileIdentity) return

    const preferences = readProfilePreferences(profileIdentity.id)

    setMaturity(preferences.maturity)

    setLanguage(preferences.language)

    setDirty(false)
  }, [profileIdentity?.id])

  // Modals

  const [editOpen, setEditOpen] = useState(false)

  const [pinOpen, setPinOpen] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)

  const [manageOpen, setManageOpen] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)

  // Cards

  const [cards, setCards] = useState(INITIAL_CARDS)

  function markDirty() {
    setDirty(true)

    setSaved(false)
  }

  function handleSave() {
    if (!profileIdentity) return

    writeProfilePreferences(profileIdentity.id, { language, maturity })

    setDirty(false)

    setSaved(true)

    setTimeout(() => setSaved(false), 3000)
  }

  const joinedYear = profileIdentity?.joinedAt
    ? new Date(profileIdentity.joinedAt).getFullYear()
    : null

  const memberSinceYear =
    joinedYear && Number.isFinite(joinedYear) ? joinedYear : null

  return (
    <div className={`min-h-screen ${styles.page}`}>
      {/* Modals */}
      {editOpen && profileIdentity && (
        <EditProfileModal
          profile={profileIdentity}
          onClose={() => setEditOpen(false)}
          onSaved={(name, preferences, avatar) => {
            setProfileIdentity((current) =>
              current
                ? {
                    ...current,
                    name,
                    avatarPath: avatar.path,
                    avatarUrl: avatar.url,
                  }
                : current,
            )

            setLanguage(preferences.language)

            setMaturity(preferences.maturity)

            setDirty(false)

            window.dispatchEvent(
              new CustomEvent("streamflix:profile-updated", {
                detail: {
                  profileId: profileIdentity.id,
                  name,
                  avatarPath: avatar.path,
                  avatar: avatar.url,
                },
              }),
            )

            setEditOpen(false)
          }}
        />
      )}
      {pinOpen && profileIdentity && (
        <PINModal
          profileId={profileIdentity.id}
          hasPin={profileIdentity.hasPin}
          onClose={() => setPinOpen(false)}
          onSaved={(hasPin) => {
            setProfileIdentity((current) =>
              current ? { ...current, hasPin } : current,
            )

            setPinOpen(false)
          }}
        />
      )}
      {historyOpen && (
        <WatchHistoryPanel
          profileId={activeProfileId ?? 0}
          onClose={() => setHistoryOpen(false)}
        />
      )}
      {manageOpen && (
        <ManageProfilesModal
          activeProfileId={activeProfileId}
          onClose={() => setManageOpen(false)}
          onActiveProfileDeleted={onProfileDeleted}
        />
      )}
      {deleteOpen && profileIdentity && (
        <DeleteProfileModal
          profile={profileIdentity}
          onClose={() => setDeleteOpen(false)}
          onDeleted={onProfileDeleted}
        />
      )}

      {/* Page content */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 pt-4 md:pt-6">
        <div className="pb-10">
          {/* Page heading */}
          <h1
            className="text-[var(--color-cream)] font-display font-bold text-4xl tracking-wide uppercase mb-8"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Profile
          </h1>

          {/* Profile identity */}
          {identityError && (
            <p role="alert" className="mb-5 text-sm text-[#ff8a8a]">
              {identityError}
            </p>
          )}
          <div
            className="flex flex-wrap items-center gap-5 mb-10"
            aria-busy={identityLoading}
          >
            <Avatar
              initials={
                profileIdentity ? initialsFor(profileIdentity.name) : "SF"
              }
              imageUrl={profileIdentity?.avatarUrl}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h2
                className="text-[var(--color-cream)] font-display font-bold text-2xl tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {identityLoading
                  ? "Loading profile…"
                  : profileIdentity?.name || "No active profile"}
              </h2>
              <p
                className="text-[var(--color-taupe)] text-sm mt-0.5"
                style={{ fontFamily: "'Barlow', sans-serif" }}
              >
                {profileIdentity
                  ? profileIdentity.isKids
                    ? "Kids profile"
                    : `Profile ${profileIdentity.displayOrder}`
                  : "Profile details unavailable"}
              </p>
              <p
                className="text-[var(--color-stone)] text-xs mt-0.5"
                style={{ fontFamily: "'Barlow', sans-serif" }}
              >
                {memberSinceYear
                  ? `Member since ${memberSinceYear}`
                  : "Membership date unavailable"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              disabled={!profileIdentity || identityLoading}
              className="px-5 py-2 border border-[var(--color-stone)] text-[var(--color-cream)] text-sm rounded-sm hover:border-[var(--color-taupe)] hover:bg-[var(--color-wine)] transition-all"
              style={{ fontFamily: "'Barlow', sans-serif" }}
            >
              Edit Profile
            </button>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-[var(--color-stone)] mb-8" />

          {/* Two-column settings layout */}
          <div className="flex flex-col lg:flex-row gap-0">
            {/* LEFT: Playback & Display (~2/3) */}
            <div className="flex-1 lg:flex-[2] pr-0 lg:pr-10">
              <h3
                className="text-[var(--color-cream)] font-display font-semibold text-xl tracking-wide uppercase mb-2"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Playback &amp; Display
              </h3>

              {profileIdentity && !profileIdentity.isKids && (
                <SettingRow
                  icon={<ShieldIcon />}
                  label="Maturity Rating"
                  description="Show titles of all maturity ratings for this profile."
                  control={
                    <SelectDropdown
                      value={maturity}
                      ariaLabel="Maturity rating"
                      options={[
                        "All Maturity Ratings",

                        "18+",

                        "16+",

                        "13+",

                        "7+",

                        "All Ages",
                      ]}
                      onChange={(v) => {
                        setMaturity(v)

                        markDirty()
                      }}
                    />
                  }
                />
              )}
              <SettingRow
                icon={<GlobeIcon />}
                label="Default Language"
                description="Select the default language for audio and subtitles."
                control={
                  <SelectDropdown
                    value={language}
                    ariaLabel="Default language"
                    options={[
                      "English",

                      "Spanish",

                      "French",

                      "Japanese",

                      "Korean",

                      "Portuguese",
                    ]}
                    onChange={(v) => {
                      setLanguage(v)

                      markDirty()
                    }}
                  />
                }
                last
              />

              {/* Save Changes */}
              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={handleSave}
                  disabled={!dirty}
                  className="px-6 py-2.5 bg-[var(--color-wine)] text-[var(--color-cream)] text-sm rounded-sm hover:bg-[var(--color-ink-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wine)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ink)]"
                  style={{ fontFamily: "'Barlow', sans-serif" }}
                >
                  Save Changes
                </button>
                {saved && (
                  <p
                    className="text-[var(--color-taupe)] text-sm"
                    style={{ fontFamily: "'Barlow', sans-serif" }}
                  >
                    Profile settings saved.
                  </p>
                )}
              </div>
            </div>

            {/* Vertical divider */}
            <div className="hidden lg:block w-px bg-[var(--color-stone)] mx-2 self-stretch" />
            <div className="block lg:hidden h-px bg-[var(--color-stone)] my-8" />

            {/* RIGHT: Viewing Activity + Profile Lock (~1/3) */}
            <div className="lg:flex-[1] lg:pl-10">
              {/* Viewing Activity */}
              <div className="mb-8">
                <h3
                  className="text-[var(--color-cream)] font-display font-semibold text-xl tracking-wide uppercase mb-2"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                >
                  Viewing Activity
                </h3>
                <RightPanelRow
                  icon={<ClockIcon />}
                  label="Watch History"
                  description="Review the movies and episodes you have watched."
                  onClick={() => setHistoryOpen(true)}
                  last
                />
              </div>

              {/* Profile Lock */}
              <div>
                <h3
                  className="text-[var(--color-cream)] font-display font-semibold text-xl tracking-wide uppercase mb-2"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                >
                  Profile Lock
                </h3>
                <RightPanelRow
                  icon={<LockIcon />}
                  label={profileIdentity?.hasPin ? "Change PIN" : "Set PIN"}
                  description="Require a PIN to access this profile."
                  onClick={() => setPinOpen(true)}
                  last
                />
              </div>

              <div className="mt-8">
                <h3
                  className="mb-2 text-xl font-semibold uppercase tracking-wide text-[var(--color-cream)]"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Profile Management
                </h3>
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[var(--color-cream)] transition-colors hover:bg-[var(--color-wine)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wine)]"
                >
                  <span className="shrink-0 text-[var(--color-taupe)]">
                    <EditIcon size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">
                      Manage Profiles
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-taupe)]">
                      Review or delete profiles disabled by your current plan.
                    </span>
                  </span>
                  <ChevronRightIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  disabled={!profileIdentity || identityLoading}
                  className="flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-red-300 transition-colors hover:bg-red-950/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="shrink-0">
                    <TrashIcon size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">
                      Delete Profile
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-taupe)]">
                      Permanently remove this profile from your account.
                    </span>
                  </span>
                  <ChevronRightIcon size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-[var(--color-stone)] mt-10 mb-8" />

          {/* Continue Watching */}
          {cards.length > 0 && (
            <div className="pb-12">
              <h3
                className="text-[var(--color-cream)] font-display font-bold text-2xl tracking-wide uppercase mb-5"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Continue Watching
              </h3>
              <div
                className="flex gap-4 overflow-x-auto pb-2"
                style={{ scrollbarWidth: "none" }}
              >
                {cards.map((card) => (
                  <ContinueWatchingCard
                    key={card.id}
                    card={card}
                    onRemove={() =>
                      setCards((prev) => prev.filter((c) => c.id !== card.id))
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
