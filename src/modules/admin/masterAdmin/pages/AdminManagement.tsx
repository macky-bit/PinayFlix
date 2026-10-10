import { useState, useMemo, useRef, useEffect } from "react"

import type { Manager, ManagerRole, AccountStatus } from "../types"

import {
  useAdminCollection,
  useAdminRepository,
  waitForAdminEditDelay,
} from "../../data"

import { supabase } from "../../../../lib/supabase"

import { formatDate, generateId } from "../utils"

import { RoleBadge, StatusBadge } from "../components/Badge"

import Toast from "../components/Toast"

import ConfirmDialog from "../components/ConfirmDialog"

import {
  AdminPageHeader,
  AdminRowAction,
  AdminStatCard,
  AdminStats,
} from "../../components/AdminUI"

import AdminDetailsPanel, {
  AdminDetailField,
  AdminDetailsSection,
} from "../../components/AdminDetailsPanel"

const ROLES: ManagerRole[] = [
  "Master Admin",
  "Content Manager",
  "Comment Manager",
  "Feedback Manager",
  "User Manager",
  "System Manager",
]

const ROLE_ACCESS: Record<ManagerRole, string> = {
  "Master Admin": "Full access to every administrator workspace and account.",

  "Content Manager": "Content, categories, genres, and soundtracks.",

  "Comment Manager": "Reviews, reactions, forum posts, and forum comments.",

  "Feedback Manager": "Platform feedback and feedback-status management.",

  "User Manager":
    "Subscribers, subscriptions, plans, and payments.",

  "System Manager":
    "System security, server maintenance, database maintenance, and backups.",
}

const SORT_OPTIONS = [
  { value: "name-az", label: "Name A–Z" },
  { value: "name-za", label: "Name Z–A" },
] as const

type AdminSort = typeof SORT_OPTIONS[number]["value"]

function normalizeAdminSort(value: string): AdminSort {
  return value === "name-za" ? "name-za" : "name-az"
}

type ModalType = "add" | "edit" | "assignRole" | "resetPassword" | null

type ConfirmType = "activate" | "deactivate" | "remove" | "confirmRole" | null

interface FormErrors {
  [key: string]: string
}

interface GrantCandidate {
  userId: string

  authUserId: string | null

  name: string

  email: string

  username: string

  accountStatus: string

  existingAdminId: string | null

  existingRole: string | null

  existingStatus: string | null
}

function LoadingSpinner() {
  return (
    <div
      className="admin-table-skeleton"
      role="status"
      aria-label="Loading administrators"
      aria-busy="true"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div className="admin-table-skeleton__row" key={index}>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  message,
  onReset,
}: {
  message: string
  onReset?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "rgba(124,58,237,0.1)" }}
      >
        <svg
          className="w-8 h-8"
          style={{ color: "var(--wine)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
          />
        </svg>
      </div>
      <p className="text-center" style={{ color: "var(--taupe)" }}>
        {message}
      </p>
      {onReset && (
        <button
          onClick={onReset}
          className="btn-wine px-4 py-2 rounded-lg text-sm font-medium"
        >
          Reset Filters
        </button>
      )}
    </div>
  )
}

function GrantAdminModal({
  onGrant,
  onClose,
}: {
  onGrant: (uuid: string, role: ManagerRole) => Promise<void>

  onClose: () => void
}) {
  const [uuid, setUuid] = useState("")

  const [role, setRole] = useState<ManagerRole>("Content Manager")

  const [candidate, setCandidate] = useState<GrantCandidate | null>(null)

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState("")

  async function searchUser(event: React.FormEvent) {
    event.preventDefault()

    const value = uuid.trim()

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      setError("Enter a valid user UUID.")

      setCandidate(null)

      return
    }

    setLoading(true)

    setError("")

    const { data, error: searchError } = await supabase.rpc(
      "find_user_for_admin",
      { target_uuid: value },
    )

    setLoading(false)

    if (searchError) {
      setError(searchError.message)

      setCandidate(null)

      return
    }

    if (!data) {
      setError("No StreamFlix user was found for that UUID.")

      setCandidate(null)

      return
    }

    const result = data as unknown as GrantCandidate

    setCandidate(result)

    const existingRole = ROLES.find(
      (item) =>
        item.replace(/\s/g, "").toLowerCase() ===
        String(result.existingRole ?? "")
          .replace(/\s/g, "")
          .toLowerCase(),
    )

    if (existingRole) setRole(existingRole)
  }

  async function grantAccess() {
    setLoading(true)

    setError("")

    try {
      await onGrant(uuid.trim(), role)
    } catch (grantError) {
      setError(
        grantError instanceof Error
          ? grantError.message
          : "Unable to grant administrator access.",
      )

      setLoading(false)
    }
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handler)

    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 560 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Make User an Admin
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--taupe)" }}>
              Search by the user's profile UUID or Auth UUID, then assign a
              role.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-white p-1 rounded"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={searchUser} className="flex gap-2">
          <div className="flex-1">
            <label
              htmlFor="admin-user-uuid"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--cream)" }}
            >
              User UUID
            </label>
            <input
              id="admin-user-uuid"
              className="input-field font-mono text-sm"
              value={uuid}
              onChange={(event) => {
                setUuid(event.target.value)
                setCandidate(null)
                setError("")
              }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn-wine self-end px-4 py-2.5 rounded-lg text-sm font-medium"
            disabled={loading || !uuid.trim()}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {error && (
          <p
            className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            role="alert"
          >
            {error}
          </p>
        )}

        {candidate && (
          <div
            className="mt-5 rounded-xl p-4"
            style={{
              border: "1px solid var(--stone)",
              backgroundColor: "rgba(255,255,255,0.02)",
            }}
          >
            <div
              className="min-w-0 pb-3"
              style={{ borderBottom: "1px solid rgba(107,114,128,.28)" }}
            >
              <p className="font-semibold text-white truncate">
                {candidate.name || candidate.username}
              </p>
              <p
                className="text-xs truncate mt-1"
                style={{ color: "var(--taupe)" }}
              >
                {candidate.email}
              </p>
            </div>
            <dl className="mt-4 grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-xs">
              <dt style={{ color: "var(--taupe)" }}>Profile UUID</dt>
              <dd className="text-white font-mono break-all">
                {candidate.userId}
              </dd>
              <dt style={{ color: "var(--taupe)" }}>Auth UUID</dt>
              <dd className="text-white font-mono break-all">
                {candidate.authUserId ?? "Not linked"}
              </dd>
              <dt style={{ color: "var(--taupe)" }}>User status</dt>
              <dd className="text-white">{candidate.accountStatus}</dd>
              <dt style={{ color: "var(--taupe)" }}>Admin access</dt>
              <dd className="text-white">
                {candidate.existingAdminId
                  ? `${candidate.existingRole} · ${candidate.existingStatus}`
                  : "Not currently an admin"}
              </dd>
            </dl>
            <div className="mt-4">
              <label
                htmlFor="grant-admin-role"
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--cream)" }}
              >
                Administrator Role
              </label>
              <select
                id="grant-admin-role"
                className="select-field"
                value={role}
                onChange={(event) => setRole(event.target.value as ManagerRole)}
              >
                {ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs" style={{ color: "var(--taupe)" }}>
                {ROLE_ACCESS[role]}
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost px-4 py-2.5 rounded-lg text-sm font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={grantAccess}
                className="btn-gold px-5 py-2.5 rounded-lg text-sm"
                disabled={loading || !candidate.authUserId}
              >
                {loading
                  ? "Saving…"
                  : candidate.existingAdminId
                    ? "Update & Activate"
                    : "Grant Admin Access"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Add Manager Modal

function AddManagerModal({
  managers,
  onAdd,
  onClose,
}: {
  managers: Manager[]

  onAdd: (m: Manager) => void

  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    confirm: "",
    role: "" as ManagerRole | "",
    status: "Active" as AccountStatus,
  })

  const [errors, setErrors] = useState<FormErrors>({})

  const [loading, setLoading] = useState(false)

  function validate() {
    const e: FormErrors = {}

    if (!form.name.trim()) e.name = "Full name is required."

    if (!form.email.trim()) e.email = "Email is required."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address."
    else if (
      managers.some((m) => m.email.toLowerCase() === form.email.toLowerCase())
    )
      e.email = "This email is already in use."

    if (!form.username.trim()) e.username = "Username is required."
    else if (
      managers.some(
        (m) => m.username.toLowerCase() === form.username.toLowerCase(),
      )
    )
      e.username = "This username is already in use."

    if (!form.password) e.password = "Password is required."
    else if (form.password.length < 8)
      e.password = "Password must be at least 8 characters."

    if (!form.confirm) e.confirm = "Please confirm the password."
    else if (form.password !== form.confirm)
      e.confirm = "Passwords do not match."

    if (!form.role) e.role = "Role is required."

    return e
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const errs = validate()

    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setLoading(true)

    setTimeout(() => {
      const newManager: Manager = {
        id: generateId("ADM", managers),

        name: form.name.trim(),

        email: form.email.trim(),

        username: form.username.trim(),

        role: form.role as ManagerRole,

        status: form.status,

        lastLogin: null,

        avatarColor:
          "#" + Math.floor(Math.random() * 0xaaaaaa + 0x555555).toString(16),
      }

      onAdd(newManager)

      setLoading(false)
    }, 800)
  }

  function field(id: string, label: string, input: React.ReactNode) {
    return (
      <div>
        <label
          htmlFor={id}
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--cream)" }}
        >
          {label} <span className="text-red-400">*</span>
        </label>
        {input}
        {errors[id] && (
          <p className="mt-1 text-xs text-red-400">{errors[id]}</p>
        )}
      </div>
    )
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handler)

    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 540 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Add Manager</h2>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-white transition-colors p-1 rounded"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          {field(
            "name",
            "Full Name",

            <input
              id="name"
              className="input-field"
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }))
                setErrors((er) => ({ ...er, name: "" }))
              }}
              placeholder="Enter full name"
              autoComplete="off"
            />,
          )}
          {field(
            "email",
            "Email",

            <input
              id="email"
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }))
                setErrors((er) => ({ ...er, email: "" }))
              }}
              placeholder="Enter email address"
              autoComplete="off"
            />,
          )}
          {field(
            "username",
            "Username",

            <input
              id="username"
              className="input-field"
              value={form.username}
              onChange={(e) => {
                setForm((f) => ({ ...f, username: e.target.value }))
                setErrors((er) => ({ ...er, username: "" }))
              }}
              placeholder="Enter username"
              autoComplete="off"
            />,
          )}
          {field(
            "password",
            "Temporary Password",

            <input
              id="password"
              type="password"
              className="input-field"
              value={form.password}
              onChange={(e) => {
                setForm((f) => ({ ...f, password: e.target.value }))
                setErrors((er) => ({ ...er, password: "" }))
              }}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />,
          )}
          {field(
            "confirm",
            "Confirm Temporary Password",

            <input
              id="confirm"
              type="password"
              className="input-field"
              value={form.confirm}
              onChange={(e) => {
                setForm((f) => ({ ...f, confirm: e.target.value }))
                setErrors((er) => ({ ...er, confirm: "" }))
              }}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />,
          )}
          {field(
            "role",
            "Role",

            <select
              id="role"
              className="select-field"
              value={form.role}
              onChange={(e) => {
                setForm((f) => ({ ...f, role: e.target.value as ManagerRole }))
                setErrors((er) => ({ ...er, role: "" }))
              }}
            >
              <option value="">Select a role</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>,
          )}
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--cream)" }}
            >
              Account Status <span className="text-red-400">*</span>
            </label>
            <select
              id="status"
              className="select-field"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as AccountStatus,
                }))
              }
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-4 py-2.5 rounded-lg text-sm font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-gold px-5 py-2.5 rounded-lg text-sm"
              disabled={loading}
            >
              {loading ? "Creating…" : "Add Manager"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Manager Modal

function EditManagerModal({
  manager,
  managers,
  onSave,
  onClose,
  onResetPassword,
}: {
  manager: Manager

  managers: Manager[]

  onSave: (m: Manager) => Promise<void>

  onClose: () => void

  onResetPassword: () => void
}) {
  const [form, setForm] = useState({
    name: manager.name,
    email: manager.email,
    username: manager.username,
  })

  const [errors, setErrors] = useState<FormErrors>({})

  const [loading, setLoading] = useState(false)

  function validate() {
    const e: FormErrors = {}

    if (!form.name.trim()) e.name = "Full name is required."

    if (!form.email.trim()) e.email = "Email is required."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address."
    else if (
      managers.some(
        (m) =>
          m.id !== manager.id &&
          m.email.toLowerCase() === form.email.toLowerCase(),
      )
    )
      e.email = "This email is already in use."

    if (!form.username.trim()) e.username = "Username is required."
    else if (
      managers.some(
        (m) =>
          m.id !== manager.id &&
          m.username.toLowerCase() === form.username.toLowerCase(),
      )
    )
      e.username = "This username is already in use."

    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const errs = validate()

    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setLoading(true)
    try {
      await onSave({
        ...manager,
        name: form.name.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handler)

    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  function field(id: string, label: string, input: React.ReactNode) {
    return (
      <div>
        <label
          htmlFor={id}
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--cream)" }}
        >
          {label}
        </label>
        {input}
        {errors[id] && (
          <p className="mt-1 text-xs text-red-400">{errors[id]}</p>
        )}
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 540 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Edit Manager</h2>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-white transition-colors p-1 rounded"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--cream)" }}
            >
              User ID
            </label>
            <div className="input-field opacity-50 cursor-not-allowed">
              {manager.id}
            </div>
          </div>
          {field(
            "name",
            "Full Name *",

            <input
              id="name"
              className="input-field"
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }))
                setErrors((er) => ({ ...er, name: "" }))
              }}
              placeholder="Enter full name"
            />,
          )}
          {field(
            "email",
            "Email *",

            <input
              id="email"
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }))
                setErrors((er) => ({ ...er, email: "" }))
              }}
              placeholder="Enter email address"
            />,
          )}
          {field(
            "username",
            "Username *",

            <input
              id="username"
              className="input-field"
              value={form.username}
              onChange={(e) => {
                setForm((f) => ({ ...f, username: e.target.value }))
                setErrors((er) => ({ ...er, username: "" }))
              }}
              placeholder="Enter username"
            />,
          )}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--cream)" }}
            >
              Last Login
            </label>
            <div className="input-field opacity-50 cursor-not-allowed">
              {formatDate(manager.lastLogin)}
            </div>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={onResetPassword}
              className="flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color: "var(--wine-hover)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--wine)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--wine-hover)")
              }
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              Reset Password
            </button>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-4 py-2.5 rounded-lg text-sm font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-gold px-5 py-2.5 rounded-lg text-sm"
              disabled={loading}
            >
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Assign Role Modal

function AssignRoleModal({
  manager,
  onAssign,
  onClose,
}: {
  manager: Manager

  onAssign: (role: ManagerRole) => Promise<void>

  onClose: () => void
}) {
  const [selectedRole, setSelectedRole] = useState<ManagerRole | "">(
    manager.role,
  )

  const [step, setStep] = useState<"select" | "confirm">("select")

  const [loading, setLoading] = useState(false)

  const canAssign = selectedRole && selectedRole !== manager.role

  async function handleConfirm() {
    setLoading(true)
    try {
      await onAssign(selectedRole as ManagerRole)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handler)

    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  if (step === "confirm") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-panel"
          style={{ maxWidth: 440 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "rgba(124,58,237,0.15)" }}
            >
              <svg
                className="w-5 h-5"
                style={{ color: "var(--wine)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">
                Confirm role change?
              </h3>
              <p className="text-sm" style={{ color: "var(--taupe)" }}>
                Changing this Manager&apos;s role will update their access to
                STREAMFLIX management features.
              </p>
            </div>
          </div>
          <div
            className="rounded-lg p-4 mb-6 flex flex-col gap-2"
            style={{
              backgroundColor: "rgba(26,16,48,0.5)",
              border: "1px solid var(--stone)",
            }}
          >
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--taupe)" }}>Manager</span>
              <span className="text-white font-medium">{manager.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--taupe)" }}>Current Role</span>
              <RoleBadge role={manager.role} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--taupe)" }}>New Role</span>
              <RoleBadge role={selectedRole as ManagerRole} />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setStep("select")}
              className="btn-ghost px-4 py-2.5 rounded-lg text-sm font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="btn-gold px-5 py-2.5 rounded-lg text-sm"
              disabled={loading}
            >
              {loading ? "Assigning…" : "Confirm Role Change"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Assign Manager Role
          </h2>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-white transition-colors p-1 rounded"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div
          className="flex items-center gap-3 mb-6 p-3 rounded-lg"
          style={{
            backgroundColor: "rgba(26,16,48,0.5)",
            border: "1px solid var(--stone)",
          }}
        >
          <div>
            <p className="text-white font-semibold text-sm">{manager.name}</p>
            <p className="text-xs" style={{ color: "var(--taupe)" }}>
              {manager.id}
            </p>
          </div>
          <div className="ml-auto">
            <RoleBadge role={manager.role} />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="new-role"
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--cream)" }}
            >
              New Role <span className="text-red-400">*</span>
            </label>
            <select
              id="new-role"
              className="select-field"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as ManagerRole)}
            >
              <option value="">Select a role</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {selectedRole && (
            <div
              className="rounded-lg p-4"
              style={{
                backgroundColor: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.25)",
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-1"
                style={{ color: "var(--wine-hover)" }}
              >
                Access Description
              </p>
              <p className="text-sm text-white">
                {ROLE_ACCESS[(selectedRole as ManagerRole)]}
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={onClose}
              className="btn-ghost px-4 py-2.5 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep("confirm")}
              disabled={!canAssign}
              className="btn-gold px-5 py-2.5 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Assign Role
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Reset Password Modal

function ResetPasswordModal({
  onReset,
  onClose,
}: {
  onReset: () => void

  onClose: () => void
}) {
  const [form, setForm] = useState({ password: "", confirm: "" })

  const [errors, setErrors] = useState<FormErrors>({})

  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const errs: FormErrors = {}

    if (!form.password) errs.password = "Password is required."
    else if (form.password.length < 8)
      errs.password = "Password must be at least 8 characters."

    if (!form.confirm) errs.confirm = "Please confirm the password."
    else if (form.password !== form.confirm)
      errs.confirm = "Passwords do not match."

    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setLoading(true)

    setTimeout(() => {
      onReset()
      setLoading(false)
    }, 700)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handler)

    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Reset Password</h2>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-white p-1 rounded"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <div>
            <label
              htmlFor="new-pw"
              className="block text-sm font-medium mb-1.5 text-white"
            >
              New Temporary Password <span className="text-red-400">*</span>
            </label>
            <input
              id="new-pw"
              type="password"
              className="input-field"
              value={form.password}
              onChange={(e) => {
                setForm((f) => ({ ...f, password: e.target.value }))
                setErrors((er) => ({ ...er, password: "" }))
              }}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="confirm-pw"
              className="block text-sm font-medium mb-1.5 text-white"
            >
              Confirm Temporary Password <span className="text-red-400">*</span>
            </label>
            <input
              id="confirm-pw"
              type="password"
              className="input-field"
              value={form.confirm}
              onChange={(e) => {
                setForm((f) => ({ ...f, confirm: e.target.value }))
                setErrors((er) => ({ ...er, confirm: "" }))
              }}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />
            {errors.confirm && (
              <p className="mt-1 text-xs text-red-400">{errors.confirm}</p>
            )}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-4 py-2.5 rounded-lg text-sm font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-gold px-5 py-2.5 rounded-lg text-sm"
              disabled={loading}
            >
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Details Panel

function ManagerDetailsPanel({
  manager,
  onClose,
}: {
  manager: Manager
  onClose: () => void
}) {
  const isDeactivated = manager.status === "Inactive"
  const [copiedId, setCopiedId] = useState(false)
  const copyId = async () => {
    await navigator.clipboard.writeText(manager.id)
    setCopiedId(true)
    window.setTimeout(() => setCopiedId(false), 1600)
  }
  const footer = (
    <button
      type="button"
      onClick={onClose}
      className="admin-details-button admin-details-button--secondary w-full"
    >
      Close
    </button>
  )

  return (
    <>
      <AdminDetailsPanel
        title="Manager Details"
        onClose={onClose}
        closeOnBackdrop
        closeOnEscape
        footer={footer}
      >
        {/* Profile */}
        <div
          className="pb-5"
          style={{ borderBottom: "1px solid var(--stone)" }}
        >
          <div>
            <p className="text-white font-semibold text-lg">{manager.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <p
                className="min-w-0 break-all text-xs font-mono"
                style={{ color: "var(--taupe)" }}
              >
                User ID: {manager.id}
              </p>
              <button
                type="button"
                onClick={() => void copyId()}
                className="shrink-0 rounded border border-violet-400/30 px-2 py-1 text-[11px] text-violet-200"
                aria-label={`Copy user ID for ${manager.name}`}
              >
                <span aria-live="polite">{copiedId ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        </div>

        <AdminDetailsSection title="Account Information">
          <AdminDetailField label="Email" value={manager.email} />
          <AdminDetailField label="Username" value={manager.username} />
          <AdminDetailField label="Role">
            <RoleBadge role={manager.role} />
          </AdminDetailField>
          <AdminDetailField label="Account Status">
            <StatusBadge status={manager.status} />
          </AdminDetailField>
          <AdminDetailField label="Last Login">
            <time
              dateTime={manager.lastLogin ?? undefined}
              title={
                manager.lastLogin
                  ? new Date(manager.lastLogin).toISOString()
                  : "This administrator has never logged in"
              }
            >
              {formatDate(manager.lastLogin)}
            </time>
          </AdminDetailField>
        </AdminDetailsSection>

        {isDeactivated && (
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm text-amber-100">
            <strong className="block">
              Administrator access is deactivated
            </strong>
            <span className="mt-1 block text-xs text-amber-100/70">
              Editing and role assignment are unavailable until this account is
              reactivated.
            </span>
          </div>
        )}
      </AdminDetailsPanel>
    </>
  )
}

// Main Page

export default function AdminManagement() {
  const managerState = useAdminCollection(
    useAdminRepository<Manager>("managers"),
  )

  const managers = managerState.items

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [search, setSearch] = useState("")

  const [roleFilter, setRoleFilter] = useState("")

  const [statusFilter, setStatusFilter] = useState("")

  const [sortBy, setSortBy] = useState<AdminSort>(() =>
    normalizeAdminSort("name-az"),
  )
  const [page, setPage] = useState(1)

  const [rowsPerPage, setRowsPerPage] = useState(10)

  const [modal, setModal] = useState<ModalType>(null)

  const [confirmType, setConfirmType] = useState<ConfirmType>(null)

  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null)

  const [toast, setToast] = useState<{
    message: string
    type?: "success" | "error"
  } | null>(null)

  const [actionPending, setActionPending] = useState(false)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)
  const [pendingResetPw, setPendingResetPw] = useState(false)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const actionMenuTriggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const actionMenuFirstItemRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (!(event.target as Element).closest(".admin-row-menu"))
        setActionMenuId(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && actionMenuId) {
        const trigger = actionMenuTriggerRefs.current.get(actionMenuId)
        setActionMenuId(null)
        window.requestAnimationFrame(() => trigger?.focus())
      }
    }
    document.addEventListener("pointerdown", closeMenu)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeMenu)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [actionMenuId])

  useEffect(() => {
    if (!actionMenuId) return
    window.requestAnimationFrame(() =>
      actionMenuFirstItemRefs.current.get(actionMenuId)?.focus(),
    )
  }, [actionMenuId])

  const selectedManager = useMemo(
    () => managers.find((m) => m.id === selectedId) ?? null,
    [managers, selectedId],
  )
  const actionTargetManager = useMemo(
    () => managers.find((m) => m.id === actionTargetId) ?? null,
    [managers, actionTargetId],
  )

  function isInteractiveRowTarget(target: EventTarget | null) {
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          'button, a, input, select, textarea, [role="button"], [role="menu"], [role="menuitem"]',
        ),
      )
    )
  }

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type })
  }

  const filtered = useMemo(() => {
    let list = [...managers]

    const q = search.toLowerCase()

    if (q)
      list = list.filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.username.toLowerCase().includes(q),
      )

    if (roleFilter) list = list.filter((m) => m.role === roleFilter)
    if (statusFilter) list = list.filter((m) => m.status === statusFilter)
    list.sort((a, b) => {
      const comparison = a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
      })
      return sortBy === "name-za" ? -comparison : comparison
    })

    return list
  }, [managers, search, roleFilter, statusFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))

  const safePage = Math.min(page, totalPages)

  const pageStart = (safePage - 1) * rowsPerPage

  const paginated = filtered.slice(pageStart, pageStart + rowsPerPage)

  function resetFilters() {
    setSearch("")
    setRoleFilter("")
    setStatusFilter("")
    setSortBy("name-az")
    setPage(1)
  }

  function handleAddManager(m: Manager) {
    const { id: _id, ...input } = m

    void managerState.create(input)

    setSelectedId(m.id)

    setModal(null)

    showToast("Manager account created successfully.")

    addBtnRef.current?.focus()
  }

  async function handleGrantAdmin(uuid: string, role: ManagerRole) {
    const { error } = await supabase.rpc("grant_admin_access", {
      target_uuid: uuid,
      assigned_role: role,
    })

    if (error) throw error

    await managerState.reload()

    setModal(null)

    showToast("Administrator access granted successfully.")

    addBtnRef.current?.focus()
  }

  async function handleEditSave(updated: Manager) {
    const previous = managers.find((manager) => manager.id === updated.id)

    if (!previous) return

    await waitForAdminEditDelay()

    const { error: profileError } = await supabase.rpc("update_admin_profile", {
      target_admin_id: updated.id,

      new_name: updated.name,

      new_email: updated.email,

      new_username: updated.username,
    })

    if (profileError) {
      showToast(profileError.message, "error")
      return
    }

    if (updated.role !== previous.role) {
      const { error } = await supabase.rpc("set_admin_access_role", {
        target_admin_id: updated.id,
        assigned_role: updated.role,
      })

      if (error) {
        showToast(error.message, "error")
        return
      }
    }

    if (updated.status !== previous.status) {
      const { error } = await supabase.rpc("set_admin_access_status", {
        target_admin_id: updated.id,
        new_status: updated.status,
      })

      if (error) {
        showToast(error.message, "error")
        return
      }
    }

    await managerState.reload()
    setModal(null)
    setActionTargetId(null)
    showToast("Manager account updated successfully.")
  }

  async function handleAssignRole(role: ManagerRole) {
    if (!actionTargetId) return
    await waitForAdminEditDelay()
    const { error } = await supabase.rpc("set_admin_access_role", {
      target_admin_id: actionTargetId,
      assigned_role: role,
    })
    if (error) {
      showToast(error.message, "error")
      return
    }

    await managerState.reload()
    setModal(null)
    setActionTargetId(null)
    showToast("Manager role updated successfully.")
  }

  async function handleStatusChange(id: string, status: AccountStatus) {
    setActionPending(true)

    try {
      await waitForAdminEditDelay()
      const { error } = await supabase.rpc("set_admin_access_status", {
        target_admin_id: id,
        new_status: status,
      })

      if (error) throw error

      await managerState.reload()

      setStatusFilter("")

      setPage(1)

      setConfirmType(null)

      setConfirmTargetId(null)

      showToast(
        `Manager account ${
          status === "Active" ? "activated" : "deactivated"
        } successfully.`,
      )
    } catch (reason) {
      const message =
        reason && typeof reason === "object" && "message" in reason
          ? String(reason.message)
          : `Unable to ${
              status === "Active" ? "activate" : "deactivate"
            } this administrator.`

      showToast(message, "error")
    } finally {
      setActionPending(false)
    }
  }

  async function handleRemoveAdmin(id: string) {
    if (actionPending) return
    setActionPending(true)

    try {
      const { error } = await supabase.rpc("remove_admin_access", {
        target_admin_id: id,
      })

      if (error) throw error

      await managerState.reload()

      setSelectedId(null)

      setConfirmType(null)

      setConfirmTargetId(null)

      showToast("Administrator role removed. The user account remains active.")
    } catch (reason) {
      const message =
        reason && typeof reason === "object" && "message" in reason
          ? String(reason.message)
          : "Unable to remove this administrator."
      showToast(message, "error")
    } finally {
      setActionPending(false)
    }
  }

  function handleResetPassword() {
    setPendingResetPw(false)

    setModal("edit")

    showToast("Manager password reset successfully.")
  }

  // Confirm dialogs for activate/deactivate

  const confirmTarget = confirmTargetId
    ? managers.find((m) => m.id === confirmTargetId)
    : null

  return (
    <div className="admin-page-shell master-admin-workspace">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirm: activate/deactivate from actions column */}
      {(confirmType === "activate" ||
        confirmType === "deactivate" ||
        confirmType === "remove") &&
        confirmTarget && (
          <ConfirmDialog
            heading={
              confirmType === "activate"
                ? "Activate Manager account?"
                : confirmType === "deactivate"
                  ? "Deactivate Manager account?"
                  : "Remove this administrator role?"
            }
            message={
              confirmType === "activate"
                ? `${confirmTarget.name} will regain access to the features assigned to their role.`
                : confirmType === "deactivate"
                  ? `${confirmTarget.name} will temporarily lose access to STREAMFLIX management features until activated again.`
                  : `This permanently removes ${confirmTarget.name}'s administrator privileges. Their regular StreamFlix user account and login will not be deleted.`
            }
            confirmLabel={
              confirmType === "activate"
                ? "Activate Account"
                : confirmType === "deactivate"
                  ? "Deactivate Account"
                  : "Remove as Admin"
            }
            onConfirm={() =>
              confirmType === "remove"
                ? handleRemoveAdmin(confirmTarget.id)
                : handleStatusChange(
                    confirmTarget.id,
                    confirmType === "activate" ? "Active" : "Inactive",
                  )
            }
            onCancel={() => {
              setConfirmType(null)
              setConfirmTargetId(null)
            }}
            danger={confirmType !== "activate"}
            loading={actionPending}
          />
        )}

      {/* Modals */}
      {modal === "add" && (
        <GrantAdminModal
          onGrant={handleGrantAdmin}
          onClose={() => {
            setModal(null)
            addBtnRef.current?.focus()
          }}
        />
      )}
      {modal === "edit" && actionTargetManager && !pendingResetPw && (
        <EditManagerModal
          manager={actionTargetManager}
          managers={managers}
          onSave={handleEditSave}
          onClose={() => {
            setModal(null)
            setActionTargetId(null)
          }}
          onResetPassword={() => {
            setModal(null)
            setPendingResetPw(true)
          }}
        />
      )}
      {pendingResetPw && (
        <ResetPasswordModal
          onReset={handleResetPassword}
          onClose={() => {
            setPendingResetPw(false)
            setModal("edit")
          }}
        />
      )}
      {modal === "assignRole" && actionTargetManager && (
        <AssignRoleModal
          manager={actionTargetManager}
          onAssign={handleAssignRole}
          onClose={() => {
            setModal(null)
            setActionTargetId(null)
          }}
        />
      )}

      <AdminPageHeader
        eyebrow="Access control"
        title="Admin Management"
        description="Manage administrator accounts, assigned roles, and access to StreamFlix operations."
        actions={
          <button
            type="button"
            ref={addBtnRef}
            onClick={() => setModal("add")}
            className="btn-primary flex items-center gap-2 px-5 py-2.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Administrator
          </button>
        }
      />

      <AdminStats>
        <AdminStatCard
          label="Administrators"
          value={managers.length}
          hint="All assigned accounts"
          tone="purple"
          active={!statusFilter && !roleFilter}
          onClick={() => {
            setSearch("")
            setStatusFilter("")
            setRoleFilter("")
            setPage(1)
          }}
        />
        <AdminStatCard
          label="Active access"
          value={
            managers.filter((manager) => manager.status === "Active").length
          }
          hint="Can enter assigned workspaces"
          tone="green"
          active={statusFilter === "Active"}
          onClick={() => {
            setStatusFilter("Active")
            setPage(1)
          }}
        />
        <AdminStatCard
          label="Deactivated"
          value={
            managers.filter((manager) => manager.status === "Inactive").length
          }
          hint="Temporarily restricted"
          tone="gold"
          active={statusFilter === "Inactive"}
          onClick={() => {
            setStatusFilter("Inactive")
            setPage(1)
          }}
        />
        <AdminStatCard
          label="Assigned roles"
          value={new Set(managers.map((manager) => manager.role)).size}
          hint="Roles represented"
          tone="blue"
          active={Boolean(roleFilter)}
          onClick={() => document.getElementById("admin-role-filter")?.focus()}
        />
      </AdminStats>

      {/* Filters */}
      <div className="admin-filter-row admin-management-filter-row flex flex-wrap items-center gap-3 mb-6">
        <div className="admin-management-filter-search relative flex-1 min-w-48">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "var(--taupe)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"
            />
          </svg>
          <input
            className="input-field"
            style={{ paddingLeft: "2.25rem" }}
            placeholder="Search administrators…"
            value={search}
            maxLength={100}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            aria-label="Search administrators"
          />
        </div>
        <select
          id="admin-role-filter"
          aria-label="Filter administrators by role"
          className="select-field admin-management-role-filter"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter administrators by status"
          className="select-field admin-management-status-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All Account Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Deactivated</option>
        </select>
        <button
          onClick={resetFilters}
          disabled={!(search || roleFilter || statusFilter || sortBy !== "name-az")}
          aria-hidden={!(search || roleFilter || statusFilter || sortBy !== "name-az")}
          tabIndex={search || roleFilter || statusFilter || sortBy !== "name-az" ? 0 : -1}
          className={`btn-violet focus-ring admin-reset-filters admin-reset-filters--reserved flex-shrink-0${
            search || roleFilter || statusFilter || sortBy !== "name-az" ? " is-visible" : ""
          }`}
        >
          Reset Filters
        </button>
        <div className="admin-management-filter-sort flex items-center gap-2">
          <svg
            className="w-4 h-4 flex-shrink-0"
            style={{ color: "var(--taupe)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
            />
          </svg>
          <select
            className="select-field"
            style={{ width: 148, minWidth: 148 }}
            value={sortBy}
            aria-label="Sort administrators"
            onChange={(e) => {
              setSortBy(normalizeAdminSort(e.target.value))
              setPage(1)
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <span
          className="admin-management-filter-count ml-auto w-32 flex-shrink-0 whitespace-nowrap text-right text-xs"
          style={{ color: "var(--taupe)" }}
        >
          {filtered.length}{" "}
          {filtered.length === 1 ? "administrator" : "administrators"}
        </span>
      </div>

      {/* Main content: table + panel */}
      <div className="admin-split-layout flex gap-4 items-start">
        {/* Table */}
        <div className="flex-1 min-w-0 card">
          <div
            className="px-5 py-4"
            style={{ borderBottom: "1px solid var(--stone)" }}
          >
            <h2 className="text-base font-semibold text-white">
              Administrators ({filtered.length})
            </h2>
          </div>
          <div className="admin-manager-table-frame">
            {managerState.loading ? (
              <LoadingSpinner />
            ) : filtered.length === 0 ? (
              <EmptyState
                message="No administrator accounts match your search or selected filters."
                onReset={resetFilters}
              />
            ) : (
              <table className="admin-manager-table text-sm" role="grid">
                <colgroup>
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--stone)" }}>
                    {[
                      "Administrator",
                      "Email",
                      "Role",
                      "Status",
                      "Last Login",
                      "Actions",
                    ].map((col) => (
                      <th
                        key={col}
                        className={`px-2 py-3 text-left text-xs font-semibold uppercase tracking-wider${col === "Actions" ? " admin-table-head--actions" : ""}`}
                        style={{ color: "var(--taupe)" }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((m) => {
                    const isSelected = selectedId === m.id

                    return (
                      <tr
                        key={m.id}
                        onClick={(event) => {
                          if (isInteractiveRowTarget(event.target)) return
                          setSelectedId(isSelected ? null : m.id)
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "table-row-selected" : ""
                        } ${
                          m.status === "Inactive"
                            ? "admin-manager-row--deactivated"
                            : ""
                        }`}
                        style={{
                          borderBottom: "1px solid rgba(55,65,81,0.5)",
                        }}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (isInteractiveRowTarget(event.target)) return
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedId(isSelected ? null : m.id)
                          }
                        }}
                        aria-selected={isSelected}
                        role="row"
                      >
                        <td className="px-2 py-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                              style={{
                                background: m.avatarColor || "var(--wine)",
                              }}
                              aria-hidden="true"
                            >
                              {m.name
                                .split(/\s+/)
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <span className="text-white font-semibold truncate text-xs block">
                                {m.name}
                              </span>
                              <span
                                className="text-[11px] truncate block mt-0.5"
                                style={{ color: "#7f778d" }}
                              >
                                @{m.username}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className="text-xs truncate block"
                            style={{ color: "var(--taupe)" }}
                            title={m.email}
                          >
                            {m.email}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <RoleBadge role={m.role} />
                        </td>
                        <td className="px-2 py-3">
                          <StatusBadge status={m.status} />
                        </td>
                        <td className="px-2 py-3">
                          <time
                            className="text-xs block"
                            style={{ color: "var(--taupe)" }}
                            dateTime={m.lastLogin ?? undefined}
                            title={
                              m.lastLogin
                                ? new Date(m.lastLogin).toISOString()
                                : "This administrator has never logged in"
                            }
                          >
                            {formatDate(m.lastLogin)}
                          </time>
                        </td>
                        <td className="px-2 py-3">
                          <div
                            className="admin-manager-table__actions admin-row-menu"
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            {m.status === "Inactive" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmTargetId(m.id)
                                  setConfirmType("activate")
                                }}
                                className="manager-status-action manager-status-action--activate"
                                disabled={actionPending}
                              >
                                Reactivate
                              </button>
                            ) : (
                              <>
                                <AdminRowAction
                                  action="view"
                                  name={m.name}
                                  onClick={() => setSelectedId(m.id)}
                                />
                                <div className="relative">
                                  <button
                                    ref={(element) => {
                                      if (element)
                                        actionMenuTriggerRefs.current.set(
                                          m.id,
                                          element,
                                        )
                                      else
                                        actionMenuTriggerRefs.current.delete(
                                          m.id,
                                        )
                                    }}
                                    type="button"
                                    className="admin-row-menu__trigger"
                                    onPointerDown={(event) =>
                                      event.stopPropagation()
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setActionMenuId(
                                        actionMenuId === m.id ? null : m.id,
                                      )
                                    }}
                                    aria-label={`More actions for ${m.name}`}
                                    aria-expanded={actionMenuId === m.id}
                                    aria-haspopup="menu"
                                  >
                                    •••
                                  </button>
                                  {actionMenuId === m.id && (
                                    <div
                                      className="admin-row-menu__popover"
                                      role="menu"
                                      aria-label={`Actions for ${m.name}`}
                                      onPointerDown={(event) =>
                                        event.stopPropagation()
                                      }
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                      onKeyDown={(event) => {
                                        event.stopPropagation()
                                        if (event.key === "Escape") {
                                          event.preventDefault()
                                          setActionMenuId(null)
                                          window.requestAnimationFrame(() =>
                                            actionMenuTriggerRefs.current
                                              .get(m.id)
                                              ?.focus(),
                                          )
                                        }
                                      }}
                                    >
                                      <button
                                        ref={(element) => {
                                          if (element)
                                            actionMenuFirstItemRefs.current.set(
                                              m.id,
                                              element,
                                            )
                                          else
                                            actionMenuFirstItemRefs.current.delete(
                                              m.id,
                                            )
                                        }}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                          setActionTargetId(m.id)
                                          setModal("edit")
                                          setActionMenuId(null)
                                        }}
                                      >
                                        Edit profile
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                          setActionTargetId(m.id)
                                          setModal("assignRole")
                                          setActionMenuId(null)
                                        }}
                                      >
                                        Change role
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                          setConfirmTargetId(m.id)
                                          setConfirmType("deactivate")
                                          setActionMenuId(null)
                                        }}
                                      >
                                        Deactivate
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="is-danger"
                                        onClick={() => {
                                          setConfirmTargetId(m.id)
                                          setConfirmType("remove")
                                          setActionMenuId(null)
                                        }}
                                      >
                                        Remove admin access
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            style={{ borderTop: "1px solid var(--stone)" }}
          >
            <div
              className="flex flex-wrap items-center gap-3 text-xs"
              style={{ color: "var(--taupe)" }}
            >
              <span>
                Showing {filtered.length === 0 ? 0 : pageStart + 1}–
                {Math.min(pageStart + rowsPerPage, filtered.length)} of{" "}
                {filtered.length} administrators
              </span>
              <select
                className="admin-select"
                value={rowsPerPage}
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value))
                  setPage(1)
                }}
                aria-label="Rows per page for administrators"
              >
                {[10, 25, 50].map((amount) => (
                  <option key={amount} value={amount}>
                    {amount} per page
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                style={{ border: "1px solid var(--stone)" }}
                onMouseEnter={(e) => {
                  if (safePage > 1)
                    e.currentTarget.style.borderColor = "var(--wine)"
                }}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--stone)")
                }
                aria-label="Previous page"
              >
                <svg
                  className="w-4 h-4"
                  style={{ color: "var(--cream)" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors"
                  style={
                    p === safePage
                      ? { backgroundColor: "var(--wine)", color: "white" }
                      : {
                          border: "1px solid var(--stone)",
                          color: "var(--taupe)",
                        }
                  }
                  aria-label={`Page ${p}`}
                  aria-current={p === safePage ? "page" : undefined}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                style={{ border: "1px solid var(--stone)" }}
                onMouseEnter={(e) => {
                  if (safePage < totalPages)
                    e.currentTarget.style.borderColor = "var(--wine)"
                }}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--stone)")
                }
                aria-label="Next page"
              >
                <svg
                  className="w-4 h-4"
                  style={{ color: "var(--cream)" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Details Panel */}
        {selectedManager && (
          <ManagerDetailsPanel
            manager={selectedManager}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  )
}
