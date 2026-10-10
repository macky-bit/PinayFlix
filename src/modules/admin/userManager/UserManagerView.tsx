import { useState, useEffect } from "react"

import { useAdminCollection, useAdminRepository } from "../data"

import {
  AdminPageHeader,
  AdminRowAction,
  AdminStatCard,
  AdminStats,
  AdminTablePagination,
  AdminWorkspaceTabs,
} from "../components/AdminUI"

import AdminDetailsPanel, {
  AdminDetailField,
  AdminDetailGrid,
  AdminDetailsSection,
} from "../components/AdminDetailsPanel"
import { useDeleteConfirmationDelay } from "../components/useDeleteConfirmationDelay"

// ─── Types ───────────────────────────────────────────────────────────────────

type AccountStatus = "Active" | "Suspended" | "Inactive"

type SubStatus = "Active" | "Inactive" | "Expired" | "Cancelled"

type PayStatus = "Paid" | "Pending" | "Failed"

interface Subscriber {
  id: string

  firstName: string

  lastName: string

  email: string

  username: string

  dob: string

  mobile: string

  registeredAt: string

  status: AccountStatus

  avatar: string
}

interface WatchRecord {
  id: string

  subscriberId: string

  subscriberName: string

  contentId: string

  contentTitle: string

  watchDate: string

  progress: number

  lastPlayback: string

  thumbnail: string
}

interface Plan {
  id: string

  name: string

  price: number

  maxUsers: number

  description: string

  subscriberCount: number
}

interface Subscription {
  id: string

  subscriberId: string

  subscriberName: string

  planId: string

  plan: string

  startDate: string

  endDate: string

  status: SubStatus
}

interface Payment {
  id: string

  subscriptionId: string

  subscriberId: string

  subscriberName: string

  amount: number

  method: string

  reference: string

  paymentDate: string

  status: PayStatus
}

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

function formatPeso(amount: number) {
  return pesoFormatter.format(amount)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({
  status,
}: {
  status: AccountStatus | SubStatus | PayStatus
}) {
  const map: Record<string, {
    dot: string
    text: string
    bg: string
    label: string
  }> = {
    Active: {
      dot: "#22C55E",
      text: "#22C55E",
      bg: "rgba(34,197,94,0.12)",
      label: "Active",
    },

    Suspended: {
      dot: "#F59E0B",
      text: "#F59E0B",
      bg: "rgba(245,158,11,0.12)",
      label: "Suspended",
    },

    Inactive: {
      dot: "#6B7280",
      text: "#6B7280",
      bg: "rgba(107,114,128,0.12)",
      label: "Inactive",
    },

    Expired: {
      dot: "#EF4444",
      text: "#EF4444",
      bg: "rgba(239,68,68,0.12)",
      label: "Expired",
    },

    Cancelled: {
      dot: "#6B7280",
      text: "#6B7280",
      bg: "rgba(107,114,128,0.12)",
      label: "Cancelled",
    },

    Paid: {
      dot: "#22C55E",
      text: "#22C55E",
      bg: "rgba(34,197,94,0.12)",
      label: "Paid",
    },

    Pending: {
      dot: "#F59E0B",
      text: "#F59E0B",
      bg: "rgba(245,158,11,0.12)",
      label: "Pending",
    },

    Failed: {
      dot: "#EF4444",
      text: "#EF4444",
      bg: "rgba(239,68,68,0.12)",
      label: "Failed",
    },
  }

  const s = map[status] || map.Inactive

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 20,
        background: s.bg,
        fontSize: 12,
        fontWeight: 600,
        color: s.text,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: s.dot,
          flexShrink: 0,
        }}
        aria-hidden
      />
      {s.label}
    </span>
  )
}

function shortId(id: string) {
  if (id.length <= 12) return id

  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 5,
          background: "#1A1030",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "linear-gradient(90deg, #7C3AED, #F5A800)",
            borderRadius: 3,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          color: "#9CA3AF",
          minWidth: 32,
          textAlign: "right",
        }}
      >
        {pct}%
      </span>
    </div>
  )
}

function VioletBtn({
  children,
  onClick,
  style,
}: {
  children: React.ReactNode
  onClick?: () => void
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        border: "1px solid #7C3AED",
        borderRadius: 6,
        background: "transparent",
        color: "#7C3AED",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontFamily: "inherit",
        transition: "all 0.15s",
        ...style,
      }}
      onMouseEnter={(e) => {
        ;(e.target as HTMLElement).style.background = "rgba(124,58,237,0.15)"
        ;(e.target as HTMLElement).style.color = "#8B5CF6"
      }}
      onMouseLeave={(e) => {
        ;(e.target as HTMLElement).style.background = "transparent"
        ;(e.target as HTMLElement).style.color = "#7C3AED"
      }}
    >
      {children}
    </button>
  )
}

function GoldBtn({
  children,
  onClick,
  style,
  disabled = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  style?: React.CSSProperties
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-busy={disabled || undefined}
      style={{
        padding: "6px 16px",
        border: "none",
        borderRadius: 6,
        background: "linear-gradient(135deg, #F5A800, #FF6B00)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.68 : 1,
        whiteSpace: "nowrap",
        fontFamily: "inherit",
        transition: "all 0.15s",
        ...style,
      }}
      onMouseEnter={(e) => {
        ;(e.target as HTMLElement).style.background =
          "linear-gradient(135deg, #FFB800, #FF8C00)"
      }}
      onMouseLeave={(e) => {
        ;(e.target as HTMLElement).style.background =
          "linear-gradient(135deg, #F5A800, #FF6B00)"
      }}
    >
      {children}
    </button>
  )
}

function DangerBtn({
  children,
  onClick,
  style,
  disabled = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  style?: React.CSSProperties
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 14px",
        border: "1px solid #EF4444",
        borderRadius: 6,
        background: "transparent",
        color: "#EF4444",
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.68 : 1,
        whiteSpace: "nowrap",
        fontFamily: "inherit",
        transition: "all 0.15s",
        ...style,
      }}
      onMouseEnter={(e) => {
        ;(e.target as HTMLElement).style.background = "rgba(239,68,68,0.12)"
      }}
      onMouseLeave={(e) => {
        ;(e.target as HTMLElement).style.background = "transparent"
      }}
    >
      {children}
    </button>
  )
}

function Select({
  value,
  onChange,
  options,
  style,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  style?: React.CSSProperties
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="content-command-bar__select"
      style={style}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
      <svg
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#9CA3AF",
        }}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        maxLength={100}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "8px 12px 8px 34px",
          background: "#150D2A",
          border: "1px solid #374151",
          borderRadius: 6,
          color: "#fff",
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
        onBlur={(e) => (e.target.style.borderColor = "#374151")}
      />
    </div>
  )
}

interface PaginationProps {
  total: number

  page: number

  perPage: number

  onPage: (p: number) => void

  onPerPage?: (n: number) => void

  label: string
}

function Pagination({
  total,
  page,
  perPage,
  onPage,
  onPerPage,
  label,
}: PaginationProps) {
  return (
    <AdminTablePagination
      page={page}
      total={total}
      perPage={perPage}
      onPage={onPage}
      onPerPage={onPerPage}
      label={label}
    />
  )

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const start = (page - 1) * perPage + 1

  const end = Math.min(page * perPage, total)

  const pageNums: (number | "...")[] = []

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNums.push(i)
  } else {
    pageNums.push(1)

    if (page > 3) pageNums.push("...")

    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    )
      pageNums.push(i)

    if (page < totalPages - 2) pageNums.push("...")

    pageNums.push(totalPages)
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,

    border: active ? "none" : "1px solid #374151",

    background: active ? "#7C3AED" : "transparent",

    color: active ? "#fff" : "#9CA3AF",

    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  })

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        borderTop: "1px solid #374151",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, color: "#9CA3AF" }}>
        Showing {total === 0 ? 0 : start}–{end} of {total} {label}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {onPerPage && (
          <select
            className="admin-select"
            value={perPage}
            onChange={(event) => onPerPage?.(Number(event.target.value))}
            aria-label={`Rows per page for ${label}`}
          >
            {[10, 25, 50].map((amount) => (
              <option key={amount} value={amount}>
                {amount} per page
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page === 1}
          style={{
            ...btnStyle(false),
            opacity: page === 1 ? 0.4 : 1,
            cursor: page === 1 ? "not-allowed" : "pointer",
          }}
          aria-label="Previous page"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        {pageNums.map((n, i) =>
          n === "..." ? (
            <span key={i} style={{ color: "#9CA3AF", padding: "0 4px" }}>
              …
            </span>
          ) : (
            <button
              key={n}
              onClick={() => onPage(n as number)}
              style={btnStyle(page === n)}
            >
              {n}
            </button>
          ),
        )}
        <button
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          style={{
            ...btnStyle(false),
            opacity: page === totalPages ? 0.4 : 1,
            cursor: page === totalPages ? "not-allowed" : "pointer",
          }}
          aria-label="Next page"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  )
}

// ─── Notification Toast ───────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)

    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: "linear-gradient(135deg, #150D2A, #1A1030)",
        border: "1px solid #7C3AED",
        borderRadius: 10,
        padding: "14px 20px",
        color: "#fff",
        fontSize: 14,
        boxShadow: "0 8px 32px rgba(124,58,237,0.3)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        maxWidth: 360,
        fontFamily: "Barlow, sans-serif",
      }}
    >
      <span style={{ color: "#22C55E", fontSize: 18 }}>✓</span>
      {message}
      <button
        onClick={onClose}
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          color: "#9CA3AF",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

function ConfirmDialog({
  heading,
  message,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  danger = false,
}: {
  heading: string
  message: string
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  danger?: boolean
}) {
  const isDeleteAction = /^(delete|remove)\b/i.test(confirmLabel)
  const { beginConfirmation, secondsRemaining, waiting } =
    useDeleteConfirmationDelay(onConfirm, isDeleteAction)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }

    window.addEventListener("keydown", handler)

    return () => window.removeEventListener("keydown", handler)
  }, [onCancel])

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#150D2A",
          border: "1px solid #7C3AED",
          borderRadius: 12,
          padding: 32,
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 20px 60px rgba(124,58,237,0.25)",
        }}
      >
        <h3
          style={{
            margin: "0 0 12px",
            fontSize: 18,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          {heading}
        </h3>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14,
            color: "#9CA3AF",
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <VioletBtn onClick={onCancel}>Cancel</VioletBtn>
          {danger ? (
            <DangerBtn onClick={beginConfirmation} disabled={waiting}>
              {waiting ? `${confirmLabel} in ${secondsRemaining}s` : confirmLabel}
            </DangerBtn>
          ) : (
            <GoldBtn onClick={beginConfirmation} disabled={waiting}>
              {waiting ? `${confirmLabel} in ${secondsRemaining}s` : confirmLabel}
            </GoldBtn>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Table Shell ──────────────────────────────────────────────────────────────

function TableShell({
  headers,
  children,
}: {
  headers: React.ReactNode[]
  children: React.ReactNode
}) {
  return (
    <div className="card user-manager-table-card">
      <div className="admin-manager-table-frame table-scroll">
        <table
          className="admin-manager-table user-manager-table"
          style={{ minWidth: 800 }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #374151" }}>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={typeof h === "string" && ["Joined", "Status", "Subscribers"].includes(h) ? "admin-table-head--emphasis" : undefined}
                  style={{
                    padding: "12px 14px",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

function Tr({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode
  selected?: boolean
  onClick?: () => void
}) {
  const [hov, setHov] = useState(false)

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderBottom: "1px solid #1F1435",

        background: selected
          ? "rgba(124,58,237,0.12)"
          : hov
            ? "rgba(124,58,237,0.06)"
            : "transparent",

        borderLeft: selected ? "3px solid #7C3AED" : "3px solid transparent",

        cursor: onClick ? "pointer" : "default",

        transition: "all 0.12s",
      }}
    >
      {children}
    </tr>
  )
}

function Td({
  children,
  style,
}: {
  children?: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <td
      style={{
        padding: "11px 14px",
        fontSize: 13,
        color: "#fff",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  )
}

// ─── Label / Input ────────────────────────────────────────────────────────────

function FormField({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#9CA3AF",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </label>
      {children}
      {error && (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#EF4444" }}>
          {error}
        </p>
      )}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  readOnly,
  type = "text",
  style,
}: {
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  type?: string
  style?: React.CSSProperties
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{
        width: "100%",
        padding: "9px 12px",
        background: readOnly ? "rgba(55,65,81,0.3)" : "var(--color-ink)",
        border: `1px solid ${readOnly ? "#2D2045" : "#374151"}`,
        borderRadius: 6,
        color: readOnly ? "#6B7280" : "#fff",
        fontSize: 13,
        fontFamily: "inherit",
        outline: "none",
        cursor: readOnly ? "not-allowed" : "text",
        boxSizing: "border-box",
        ...style,
      }}
      onFocus={(e) => {
        if (!readOnly) e.target.style.borderColor = "#7C3AED"
      }}
      onBlur={(e) => {
        if (!readOnly) e.target.style.borderColor = "#374151"
      }}
    />
  )
}

// ─── Panel / Drawer ───────────────────────────────────────────────────────────

function Panel({
  title,
  onClose,
  children,
  width = 420,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: number
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    window.addEventListener("keydown", h)

    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 800,
          background: "rgba(0,0,0,0.5)",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 801,
          width: Math.min(width, window.innerWidth),
          background: "#150D2A",
          borderLeft: "1px solid #7C3AED",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px",
            borderBottom: "1px solid #374151",
            position: "sticky",
            top: 0,
            background: "#150D2A",
            zIndex: 1,
          }}
        >
          <h2
            style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#fff" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "#9CA3AF",
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 20, flex: 1 }}>{children}</div>
      </aside>
    </>
  )
}

// ─── Subscribers Tab ──────────────────────────────────────────────────────────

function SubscribersTab({
  onToast,
  navigateToSubscription,
}: {
  onToast: (m: string) => void
  navigateToSubscription: (subId: string) => void
}) {
  const subscriberState = useAdminCollection(
    useAdminRepository<Subscriber>("subscribers"),
  )

  const subscriptions = useAdminCollection(
    useAdminRepository<Subscription>("subscriptions"),
  ).items

  const subscribers = subscriberState.items

  const [search, setSearch] = useState("")

  const [statusFilter, setStatusFilter] = useState("All Account Statuses")

  const [dateFilter, setDateFilter] = useState("All Registration Dates")

  const [sort, setSort] = useState("Newest First")

  const [page, setPage] = useState(1)

  const [perPage, setPerPage] = useState(10)

  const [activePlansOnly, setActivePlansOnly] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<"details" | "edit" | null>(null)

  const [confirm, setConfirm] = useState<{
    type: "status"
    newStatus: AccountStatus
  } | null>(null)

  const [editData, setEditData] = useState<Subscriber | null>(null)

  const [editErrors, setEditErrors] =
    useState<Partial<Record<keyof Subscriber, string>>>({})

  const subscriptionsBySubscriber = new Map(
    subscriptions.map((subscription) => [
      subscription.subscriberId,
      subscription,
    ]),
  )

  const filtered = subscribers
    .filter((s) => {
      const q = search.toLowerCase()

      if (
        q &&
        !`${s.id} ${s.firstName} ${s.lastName} ${s.email} ${s.username} ${s.mobile}`
          .toLowerCase()
          .includes(q)
      )
        return false

      if (statusFilter !== "All Account Statuses" && s.status !== statusFilter)
        return false

      if (
        activePlansOnly &&
        subscriptionsBySubscriber.get(s.id)?.status !== "Active"
      )
        return false

      return true
    })
    .sort((a, b) => {
      if (sort === "Newest First")
        return b.registeredAt.localeCompare(a.registeredAt)

      if (sort === "Oldest First")
        return a.registeredAt.localeCompare(b.registeredAt)

      if (sort === "Name A–Z")
        return `${a.firstName} ${a.lastName}`.localeCompare(
          `${b.firstName} ${b.lastName}`,
        )

      if (sort === "Name Z–A")
        return `${b.firstName} ${b.lastName}`.localeCompare(
          `${a.firstName} ${a.lastName}`,
        )

      return 0
    })

  const paged = filtered.slice((page - 1) * perPage, page * perPage)

  const selected = subscribers.find((s) => s.id === selectedId) ?? null

  const linkedSub = selected
    ? subscriptions.find((s) => s.subscriberId === selected.id)
    : null

  const activeSubscribers = subscribers.filter(
    (subscriber) => subscriber.status === "Active",
  ).length

  const suspendedSubscribers = subscribers.filter(
    (subscriber) => subscriber.status === "Suspended",
  ).length

  const activeSubscriptions = new Set(
    subscriptions

      .filter((subscription) => subscription.status === "Active")

      .map((subscription) => subscription.subscriberId),
  ).size

  function resetFilters() {
    setSearch("")
    setStatusFilter("All Account Statuses")
    setActivePlansOnly(false)
    setDateFilter("All Registration Dates")
    setSort("Newest First")
    setPage(1)
  }

  function openEdit(sub: Subscriber) {
    setEditData({ ...sub })

    setEditErrors({})

    setViewMode("edit")
  }

  function validateEdit(): boolean {
    if (!editData) return false

    const errs: typeof editErrors = {}

    if (!editData.firstName.trim()) errs.firstName = "First name is required."

    if (!editData.lastName.trim()) errs.lastName = "Last name is required."

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editData.email))
      errs.email = "Invalid email format."

    if (!editData.username.trim()) errs.username = "Username is required."

    const dupEmail = subscribers.find(
      (s) => s.email === editData.email && s.id !== editData.id,
    )

    if (dupEmail) errs.email = "Email already in use."

    const dupUser = subscribers.find(
      (s) => s.username === editData.username && s.id !== editData.id,
    )

    if (dupUser) errs.username = "Username already in use."

    setEditErrors(errs)

    return Object.keys(errs).length === 0
  }

  function saveEdit() {
    if (!editData || !validateEdit()) return

    if (
      (editData.status === "Suspended" || editData.status === "Inactive") &&
      selected?.status === "Active"
    ) {
      setConfirm({ type: "status", newStatus: editData.status })

      return
    }

    void applyEdit(editData)
  }

  async function applyEdit(data: Subscriber) {
    try {
      await subscriberState.update(data.id, data)
      setViewMode("details")
      setConfirm(null)
      onToast("Subscriber updated successfully.")
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Update failed")
    }
  }

  return (
    <div>
      <AdminStats>
        <AdminStatCard
          label="Subscribers"
          value={subscribers.length.toLocaleString()}
          hint="Loaded accounts"
          tone="purple"
          active={statusFilter === "All Account Statuses" && !activePlansOnly}
          onClick={() => {
            setStatusFilter("All Account Statuses")
            setActivePlansOnly(false)
            setPage(1)
          }}
          actionLabel="Show all subscribers"
        />
        <AdminStatCard
          label="Active accounts"
          value={activeSubscribers.toLocaleString()}
          hint="Can access StreamFlix"
          tone="green"
          active={statusFilter === "Active" && !activePlansOnly}
          onClick={() => {
            setStatusFilter("Active")
            setActivePlansOnly(false)
            setPage(1)
          }}
          actionLabel="Filter to active accounts"
        />
        <AdminStatCard
          label="Active plans"
          value={activeSubscriptions.toLocaleString()}
          hint="Current subscriptions"
          tone="gold"
          active={activePlansOnly}
          onClick={() => {
            setStatusFilter("All Account Statuses")
            setActivePlansOnly(true)
            setPage(1)
          }}
          actionLabel="Show subscribers with active plans"
        />
        <AdminStatCard
          label="Suspended"
          value={suspendedSubscribers.toLocaleString()}
          hint="Require attention"
          tone="red"
          active={statusFilter === "Suspended" && !activePlansOnly}
          onClick={() => {
            setStatusFilter("Suspended")
            setActivePlansOnly(false)
            setPage(1)
          }}
          actionLabel="Filter to suspended accounts"
        />
      </AdminStats>
      {/* Filters */}
      <div
        className="admin-filter-row"
        style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}
      >
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search users..."
        />
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setActivePlansOnly(false)
            setPage(1)
          }}
          options={["All Account Statuses", "Active", "Suspended", "Inactive"]}
        />
        <Select
          value={dateFilter}
          onChange={(v) => {
            setDateFilter(v)
            setPage(1)
          }}
          options={[
            "All Registration Dates",
            "Today",
            "This Week",
            "This Month",
            "This Year",
            "Custom Date",
          ]}
        />
        <Select
          value={sort}
          onChange={(v) => {
            setSort(v)
            setPage(1)
          }}
          options={["Newest First", "Oldest First", "Name A–Z", "Name Z–A"]}
        />
        <VioletBtn onClick={resetFilters}>Reset Filters</VioletBtn>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          message={
            search || statusFilter !== "All Account Statuses"
              ? "No records match your search or selected filters."
              : "No subscriber accounts are available."
          }
          showReset={!!(search || statusFilter !== "All Account Statuses")}
          onReset={resetFilters}
        />
      ) : (
        <>
          <TableShell
            headers={[
              "Subscriber",
              "Email",
              "Subscription",
              "Joined",
              "Status",
              "Actions",
            ]}
          >
            {paged.map((s) => (
              <Tr
                key={s.id}
                selected={selectedId === s.id}
                onClick={() => setSelectedId(s.id)}
              >
                <Td>
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontWeight: 600,
                        color: "#fff",
                      }}
                    >
                      {s.firstName} {s.lastName}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 3,
                        fontSize: 12,
                        color: "#8f879c",
                      }}
                    >
                      @{s.username} · {shortId(s.id)}
                    </span>
                  </div>
                </Td>
                <Td style={{ color: "#9CA3AF", maxWidth: 180 }}>
                  <span
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.email}
                  </span>
                </Td>
                <Td>
                  {subscriptionsBySubscriber.get(s.id) ? (
                    <div>
                      <span style={{ display: "block", fontWeight: 500 }}>
                        {subscriptionsBySubscriber.get(s.id)?.plan}
                      </span>
                      <span style={{ display: "block", marginTop: 3 }}>
                        <StatusBadge
                          status={subscriptionsBySubscriber.get(s.id)!.status}
                        />
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: "#716a7d" }}>No subscription</span>
                  )}
                </Td>
                <Td style={{ color: "#9CA3AF", whiteSpace: "nowrap" }}>
                  {s.registeredAt}
                </Td>
                <Td>
                  <StatusBadge status={s.status} />
                </Td>
                <Td>
                  <div
                    style={{ display: "flex", gap: 6 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AdminRowAction action="view" name={`${s.firstName} ${s.lastName}`} onClick={() => {
                      setSelectedId(s.id)
                      setViewMode("details")
                    }} />
                    <AdminRowAction action="edit" name={`${s.firstName} ${s.lastName}`} onClick={() => {
                      setSelectedId(s.id)
                      openEdit(s)
                    }} />
                  </div>
                </Td>
              </Tr>
            ))}
          </TableShell>
          <Pagination
            total={filtered.length}
            page={page}
            perPage={perPage}
            onPage={setPage}
            onPerPage={(amount) => {
              setPerPage(amount)
              setPage(1)
            }}
            label="subscribers"
          />
        </>
      )}

      {/* Subscriber Details Panel */}
      {selected && viewMode === "details" && (
        <AdminDetailsPanel
          title="Subscriber Details"
          onClose={() => setViewMode(null)}
          footer={
            <div className="admin-details-actions">
              <button
                onClick={() => setViewMode(null)}
                className="admin-details-button admin-details-button--secondary"
              >
                Close
              </button>
              <button
                onClick={() => openEdit(selected)}
                className="admin-details-button admin-details-button--primary"
              >
                Edit Subscriber
              </button>
            </div>
          }
        >
          <div
            style={{
              marginBottom: 22,
              paddingBottom: 18,
              borderBottom: "1px solid rgba(107,114,128,.3)",
            }}
          >
            <h3 style={{ margin: "0 0 3px", fontSize: 20, fontWeight: 700 }}>
              {selected.firstName} {selected.lastName}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>
              @{selected.username}
            </p>
            <div className="mt-3">
              <StatusBadge status={selected.status} />
            </div>
          </div>

          <AdminDetailsSection title="Account Information">
            <AdminDetailField label="Subscriber ID" value={selected.id} mono />
            <AdminDetailGrid>
              <AdminDetailField label="First Name" value={selected.firstName} />
              <AdminDetailField label="Last Name" value={selected.lastName} />
            </AdminDetailGrid>
            <AdminDetailField label="Email" value={selected.email} />
            <AdminDetailField
              label="Username"
              value={`@${selected.username}`}
            />
          </AdminDetailsSection>

          <AdminDetailsSection title="Personal Information">
            <AdminDetailGrid>
              <AdminDetailField label="Date of Birth" value={selected.dob} />
              <AdminDetailField label="Mobile Number" value={selected.mobile} />
            </AdminDetailGrid>
            <AdminDetailField
              label="Registration Date"
              value={selected.registeredAt}
            />
          </AdminDetailsSection>

          {/* Subscription Summary */}
          {linkedSub && (
            <AdminDetailsSection title="Subscription Summary">
              <AdminDetailField
                label="Subscription ID"
                value={linkedSub.id}
                mono
              />
              <AdminDetailGrid>
                <AdminDetailField label="Plan" value={linkedSub.plan} />
                <AdminDetailField label="Status">
                  <StatusBadge status={linkedSub.status} />
                </AdminDetailField>
                <AdminDetailField
                  label="Start Date"
                  value={linkedSub.startDate}
                />
                <AdminDetailField label="End Date" value={linkedSub.endDate} />
              </AdminDetailGrid>
              <button
                onClick={() => navigateToSubscription(linkedSub.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#7C3AED",
                  fontSize: 13,
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                  fontFamily: "inherit",
                }}
              >
                View Full Subscription →
              </button>
            </AdminDetailsSection>
          )}
        </AdminDetailsPanel>
      )}

      {/* Edit Subscriber Panel */}
      {editData && viewMode === "edit" && (
        <Panel
          title="Edit Subscriber"
          onClose={() => setViewMode(null)}
          width={480}
        >
          <FormField label="Subscriber ID">
            <TextInput value={editData.id} readOnly />
          </FormField>
          <FormField label="First Name" error={editErrors.firstName}>
            <TextInput
              value={editData.firstName}
              onChange={(v) =>
                setEditData((d) => (d ? { ...d, firstName: v } : d))
              }
            />
          </FormField>
          <FormField label="Last Name" error={editErrors.lastName}>
            <TextInput
              value={editData.lastName}
              onChange={(v) =>
                setEditData((d) => (d ? { ...d, lastName: v } : d))
              }
            />
          </FormField>
          <FormField label="Email" error={editErrors.email}>
            <TextInput
              value={editData.email}
              onChange={(v) => setEditData((d) => (d ? { ...d, email: v } : d))}
              type="email"
            />
          </FormField>
          <FormField label="Username" error={editErrors.username}>
            <TextInput
              value={editData.username}
              onChange={(v) =>
                setEditData((d) => (d ? { ...d, username: v } : d))
              }
            />
          </FormField>
          <FormField label="Date of Birth">
            <TextInput
              value={editData.dob}
              onChange={(v) => setEditData((d) => (d ? { ...d, dob: v } : d))}
              type="date"
            />
          </FormField>
          <FormField label="Mobile Number">
            <TextInput
              value={editData.mobile}
              onChange={(v) =>
                setEditData((d) => (d ? { ...d, mobile: v } : d))
              }
            />
          </FormField>
          <FormField label="Registration Date">
            <TextInput value={editData.registeredAt} readOnly />
          </FormField>
          <FormField label="Account Status">
            <select
              value={editData.status}
              onChange={(e) =>
                setEditData((d) =>
                  d ? { ...d, status: e.target.value as AccountStatus } : d,
                )
              }
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "var(--color-ink)",
                border: "1px solid #374151",
                borderRadius: 6,
                color: "#fff",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              {(["Active", "Suspended", "Inactive"] as AccountStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </select>
          </FormField>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <VioletBtn
              onClick={() => setViewMode("details")}
              style={{ flex: 1 }}
            >
              Cancel
            </VioletBtn>
            <GoldBtn onClick={saveEdit} disabled={subscriberState.mutating} style={{ flex: 1 }}>
              {subscriberState.mutating ? "Saving…" : "Save Changes"}
            </GoldBtn>
          </div>
        </Panel>
      )}

      {/* Status change confirmation */}
      {confirm?.type === "status" && editData && (
        <ConfirmDialog
          heading="Change account status?"
          message="This subscriber may temporarily lose access to STREAMFLIX services."
          onCancel={() => setConfirm(null)}
          onConfirm={() => applyEdit(editData)}
          confirmLabel="Confirm Change"
          danger
        />
      )}
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#9CA3AF",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 13,
          color: "#fff",
          fontFamily: mono ? "monospace" : "inherit",
        }}
      >
        {value}
      </p>
    </div>
  )
}

function EmptyState({
  message,
  showReset,
  onReset,
}: {
  message: string
  showReset?: boolean
  onReset?: () => void
}) {
  return (
    <div className="admin-empty-state user-manager-empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 8.5 7 7" />
      </svg>
      <p>
        {message}
      </p>
      {showReset && <VioletBtn onClick={onReset}>Reset Filters</VioletBtn>}
    </div>
  )
}

// ─── Watch History Tab ────────────────────────────────────────────────────────

function WatchHistoryTab() {
  const watchRecords = useAdminCollection(
    useAdminRepository<WatchRecord>("watch-history"),
  ).items

  const [search, setSearch] = useState("")

  const [sort, setSort] = useState("Newest First")

  const [page, setPage] = useState(1)

  const [perPage, setPerPage] = useState(10)

  const [viewId, setViewId] = useState<string | null>(null)

  const filtered = watchRecords
    .filter((r) => {
      const q = search.toLowerCase()

      return (
        !q ||
        `${r.id} ${r.subscriberId} ${r.subscriberName} ${r.contentId} ${r.contentTitle}`
          .toLowerCase()
          .includes(q)
      )
    })
    .sort((a, b) => {
      if (sort === "Newest First") return b.watchDate.localeCompare(a.watchDate)

      if (sort === "Oldest First") return a.watchDate.localeCompare(b.watchDate)

      if (sort === "Highest Progress") return b.progress - a.progress

      if (sort === "Lowest Progress") return a.progress - b.progress

      return 0
    })

  const paged = filtered.slice((page - 1) * perPage, page * perPage)

  const viewing = watchRecords.find((r) => r.id === viewId) ?? null

  return (
    <div>
      <div
        style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}
      >
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search watch history..."
        />
        <Select
          value="All Subscribers"
          onChange={() => {}}
          options={["All Subscribers"]}
        />
        <Select
          value="All Content"
          onChange={() => {}}
          options={["All Content"]}
        />
        <Select
          value="All Watch Dates"
          onChange={() => {}}
          options={["All Watch Dates"]}
        />
        <Select
          value="All Progress Levels"
          onChange={() => {}}
          options={["All Progress Levels"]}
        />
        <Select
          value={sort}
          onChange={(v) => {
            setSort(v)
            setPage(1)
          }}
          options={[
            "Newest First",
            "Oldest First",
            "Highest Progress",
            "Lowest Progress",
          ]}
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          message={
            search
              ? "No records match your search or selected filters."
              : "No viewing history is available."
          }
          showReset={!!search}
          onReset={() => setSearch("")}
        />
      ) : (
        <>
          <TableShell
            headers={[
              "History ID",
              "Subscriber ID",
              "Subscriber",
              "Content ID",
              "Content Title",
              "Watch Date",
              "Progress",
              "Last Playback",
              "Actions",
            ]}
          >
            {paged.map((r) => (
              <Tr key={r.id}>
                <Td
                  style={{
                    color: "#9CA3AF",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {r.id}
                </Td>
                <Td
                  style={{
                    color: "#9CA3AF",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {r.subscriberId}
                </Td>
                <Td style={{ fontWeight: 500 }}>{r.subscriberName}</Td>
                <Td
                  style={{
                    color: "#9CA3AF",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {r.contentId}
                </Td>
                <Td>{r.contentTitle}</Td>
                <Td style={{ color: "#9CA3AF", whiteSpace: "nowrap" }}>
                  {r.watchDate}
                </Td>
                <Td style={{ minWidth: 140 }}>
                  <ProgressBar pct={r.progress} />
                </Td>
                <Td style={{ color: "#9CA3AF", whiteSpace: "nowrap" }}>
                  {r.lastPlayback}
                </Td>
                <Td>
                  <AdminRowAction action="view" name={r.contentTitle || `watch record ${r.id}`} onClick={() => setViewId(r.id)} />
                </Td>
              </Tr>
            ))}
          </TableShell>
          <Pagination
            total={filtered.length}
            page={page}
            perPage={perPage}
            onPage={setPage}
            onPerPage={(amount) => {
              setPerPage(amount)
              setPage(1)
            }}
            label="records"
          />
        </>
      )}

      {viewing && (
        <Panel
          title="Watch History Details"
          onClose={() => setViewId(null)}
          width={420}
        >
          <img
            src={viewing.thumbnail}
            alt={viewing.contentTitle}
            style={{
              width: "100%",
              height: 140,
              objectFit: "cover",
              borderRadius: 8,
              marginBottom: 16,
            }}
          />
          <DetailRow label="History ID" value={viewing.id} mono />
          <DetailRow label="Subscriber" value={viewing.subscriberName} />
          <DetailRow label="Content Title" value={viewing.contentTitle} />
          <DetailRow label="Content ID" value={viewing.contentId} mono />
          <DetailRow label="Watch Date" value={viewing.watchDate} />
          <div style={{ marginBottom: 12 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Progress
            </span>
            <div style={{ marginTop: 8 }}>
              <ProgressBar pct={viewing.progress} />
            </div>
          </div>
          <DetailRow label="Last Playback" value={viewing.lastPlayback} />
          <p
            style={{
              fontSize: 12,
              color: "#6B7280",
              fontStyle: "italic",
              marginTop: 16,
            }}
          >
            Watch history records are read-only.
          </p>
          <VioletBtn
            onClick={() => setViewId(null)}
            style={{ marginTop: 8, width: "100%" }}
          >
            Close
          </VioletBtn>
        </Panel>
      )}
    </div>
  )
}

// ─── Subscriptions Tab ────────────────────────────────────────────────────────

function SubscriptionsTab({ focusId }: { focusId?: string | null }) {
  const subscriptions = useAdminCollection(
    useAdminRepository<Subscription>("subscriptions"),
  ).items

  const planRecords = useAdminCollection(
    useAdminRepository<Plan>("plans"),
  ).items

  const paymentRecords = useAdminCollection(
    useAdminRepository<Payment>("payments"),
  ).items

  const [search, setSearch] = useState("")

  const [planFilter, setPlanFilter] = useState("All Plans")

  const [statusFilter, setStatusFilter] = useState("All Subscription Statuses")

  const [sort, setSort] = useState("Newest First")

  const [page, setPage] = useState(1)

  const [perPage, setPerPage] = useState(10)

  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null)

  const [viewMode, setViewMode] = useState<"details" | null>(
    focusId ? "details" : null,
  )

  const plans = [
    "All Plans",
    ...Array.from(new Set(planRecords.map((p) => p.name))),
  ]

  const filtered = subscriptions
    .filter((s) => {
      const q = search.toLowerCase()

      if (
        q &&
        !`${s.id} ${s.subscriberId} ${s.subscriberName} ${s.plan}`
          .toLowerCase()
          .includes(q)
      )
        return false

      if (planFilter !== "All Plans" && s.plan !== planFilter) return false

      if (
        statusFilter !== "All Subscription Statuses" &&
        s.status !== statusFilter
      )
        return false

      return true
    })
    .sort((a, b) => {
      if (sort === "Newest First") return b.startDate.localeCompare(a.startDate)

      if (sort === "Oldest First") return a.startDate.localeCompare(b.startDate)

      if (sort === "Expiring Soon") return a.endDate.localeCompare(b.endDate)

      return 0
    })

  const paged = filtered.slice((page - 1) * perPage, page * perPage)

  const selected = subscriptions.find((s) => s.id === selectedId) ?? null

  const subscriptionTotals = subscriptions.reduce(
    (totals, subscription) => {
      if (subscription.status in totals) totals[subscription.status] += 1
      return totals
    },
    {
      Active: 0,
      Inactive: 0,
      Expired: 0,
      Cancelled: 0,
    } as Record<SubStatus, number>,
  )

  function showSubscriptionStatus(status: SubStatus) {
    setStatusFilter(status)
    setPage(1)
  }

  return (
    <div>
      <AdminStats>
        <AdminStatCard
          label="Active"
          value={subscriptionTotals.Active.toLocaleString()}
          hint="Currently subscribed"
          tone="green"
          active={statusFilter === "Active"}
          onClick={() => showSubscriptionStatus("Active")}
          actionLabel="Filter to active subscriptions"
        />
        <AdminStatCard
          label="Inactive"
          value={subscriptionTotals.Inactive.toLocaleString()}
          hint="Not currently renewing"
          tone="blue"
          active={statusFilter === "Inactive"}
          onClick={() => showSubscriptionStatus("Inactive")}
          actionLabel="Filter to inactive subscriptions"
        />
        <AdminStatCard
          label="Expired"
          value={subscriptionTotals.Expired.toLocaleString()}
          hint="Reached their end date"
          tone="gold"
          active={statusFilter === "Expired"}
          onClick={() => showSubscriptionStatus("Expired")}
          actionLabel="Filter to expired subscriptions"
        />
        <AdminStatCard
          label="Cancelled"
          value={subscriptionTotals.Cancelled.toLocaleString()}
          hint="Ended before renewal"
          tone="red"
          active={statusFilter === "Cancelled"}
          onClick={() => showSubscriptionStatus("Cancelled")}
          actionLabel="Filter to cancelled subscriptions"
        />
      </AdminStats>
      <div
        style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}
      >
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search subscriptions..."
        />
        <Select
          value={planFilter}
          onChange={(v) => {
            setPlanFilter(v)
            setPage(1)
          }}
          options={plans}
        />
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          options={[
            "All Subscription Statuses",
            "Active",
            "Inactive",
            "Expired",
            "Cancelled",
          ]}
        />
        <Select
          value="All Start Dates"
          onChange={() => {}}
          options={["All Start Dates"]}
        />
        <Select
          value="All End Dates"
          onChange={() => {}}
          options={["All End Dates"]}
        />
        <Select
          value={sort}
          onChange={(v) => {
            setSort(v)
            setPage(1)
          }}
          options={["Newest First", "Oldest First", "Expiring Soon"]}
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyState message="No subscription records are available." />
      ) : (
        <>
          <TableShell
            headers={[
              "Subscription ID",
              "Subscriber ID",
              "Subscriber",
              "Plan",
              "Start Date",
              "End Date",
              "Status",
              "Actions",
            ]}
          >
            {paged.map((s) => (
              <Tr
                key={s.id}
                selected={selectedId === s.id}
                onClick={() => setSelectedId(s.id)}
              >
                <Td
                  style={{
                    color: "#9CA3AF",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {s.id}
                </Td>
                <Td
                  style={{
                    color: "#9CA3AF",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {s.subscriberId}
                </Td>
                <Td style={{ fontWeight: 500 }}>{s.subscriberName}</Td>
                <Td>
                  <span style={{ color: "#F5A800", fontWeight: 600 }}>
                    {s.plan}
                  </span>
                </Td>
                <Td style={{ color: "#9CA3AF" }}>{s.startDate}</Td>
                <Td style={{ color: "#9CA3AF" }}>{s.endDate}</Td>
                <Td>
                  <StatusBadge status={s.status} />
                </Td>
                <Td>
                  <div
                    style={{ display: "flex", gap: 6 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AdminRowAction action="view" name={`subscription ${s.id}`} onClick={() => {
                      setSelectedId(s.id)
                      setViewMode("details")
                    }} />
                  </div>
                </Td>
              </Tr>
            ))}
          </TableShell>
          <Pagination
            total={filtered.length}
            page={page}
            perPage={perPage}
            onPage={setPage}
            onPerPage={(amount) => {
              setPerPage(amount)
              setPage(1)
            }}
            label="subscriptions"
          />
        </>
      )}

      {selected && viewMode === "details" && (
        <Panel
          title="Subscription Details"
          onClose={() => setViewMode(null)}
          width={420}
        >
          <DetailRow label="Subscription ID" value={selected.id} mono />
          <DetailRow label="Subscriber ID" value={selected.subscriberId} mono />
          <DetailRow label="Subscriber" value={selected.subscriberName} />
          <DetailRow label="Plan" value={selected.plan} />
          <DetailRow label="Start Date" value={selected.startDate} />
          <DetailRow label="End Date" value={selected.endDate} />
          <div style={{ marginBottom: 12 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Status
            </span>
            <div style={{ marginTop: 6 }}>
              <StatusBadge status={selected.status} />
            </div>
          </div>
          {paymentRecords.find((p) => p.subscriptionId === selected.id) &&
            (() => {
              const pay = paymentRecords.find(
                (p) => p.subscriptionId === selected.id,
              )!

              return (
                <div
                  style={{
                    background: "rgba(26,16,48,0.6)",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    padding: 14,
                    marginTop: 12,
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#9CA3AF",
                      textTransform: "uppercase",
                    }}
                  >
                    Payment Summary
                  </p>
                  <DetailRow label="Payment ID" value={pay.id} mono />
                  <DetailRow
                    label="Amount"
                    value={`₱${pay.amount.toLocaleString()}`}
                  />
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                      Status
                    </span>
                    <div style={{ marginTop: 4 }}>
                      <StatusBadge status={pay.status} />
                    </div>
                  </div>
                </div>
              )
            })()}
          <VioletBtn
            onClick={() => setViewMode(null)}
            style={{ width: "100%", marginTop: 24 }}
          >
            Close
          </VioletBtn>
        </Panel>
      )}
    </div>
  )
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────

function PlansTab({ onToast }: { onToast: (m: string) => void }) {
  const planState = useAdminCollection(useAdminRepository<Plan>("plans"))

  const subscriptions = useAdminCollection(
    useAdminRepository<Subscription>("subscriptions"),
  ).items

  const plans = planState.items

  const [search, setSearch] = useState("")

  const [viewMode, setViewMode] = useState<"add" | "edit" | "view" | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [formData, setFormData] = useState<Partial<Plan>>({})

  const [errors, setErrors] = useState<Partial<Record<keyof Plan, string>>>({})

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const [deleteBlocked, setDeleteBlocked] = useState(false)

  const filtered = plans.filter(
    (p) =>
      !search ||
      `${p.id} ${p.name} ${p.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )

  const selected = plans.find((p) => p.id === selectedId) ?? null

  const activePlanSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "Active",
  )
  const averagePlanPrice = plans.length
    ? plans.reduce((sum, plan) => sum + plan.price, 0) / plans.length
    : 0
  const estimatedMonthlyRevenue = activePlanSubscriptions.reduce(
    (sum, subscription) => {
      const plan = plans.find(
        (candidate) =>
          candidate.id === subscription.planId ||
          candidate.name === subscription.plan,
      )
      return sum + (plan?.price ?? 0)
    },
    0,
  )

  function validate(data: Partial<Plan>): boolean {
    const errs: typeof errors = {}

    if (!data.name?.trim()) errs.name = "Plan name is required."

    if (!data.price || data.price <= 0)
      errs.price = "Monthly price must be greater than zero."

    if (!data.maxUsers || data.maxUsers < 1 || !Number.isInteger(data.maxUsers))
      errs.maxUsers = "Maximum users must be a positive whole number."

    const dup = plans.find((p) => p.name === data.name && p.id !== data.id)

    if (dup) errs.name = "Plan name already exists."

    setErrors(errs)

    return Object.keys(errs).length === 0
  }

  function openAdd() {
    setFormData({ name: "", price: 0, maxUsers: 1, description: "" })

    setErrors({})

    setViewMode("add")
  }

  function openEdit(p: Plan) {
    setFormData({ ...p })

    setErrors({})

    setSelectedId(p.id)

    setViewMode("edit")
  }

  function saveAdd() {
    if (!validate(formData)) return

    const newPlan: Omit<Plan, "id"> = {
      name: formData.name!,

      price: formData.price!,

      maxUsers: formData.maxUsers!,

      description: formData.description || "",

      subscriberCount: 0,
    }

    void planState
      .create(newPlan)
      .catch((error: Error) => onToast(error.message))

    setViewMode(null)

    onToast("Plan added successfully.")
  }

  async function saveEdit() {
    if (!validate(formData)) return

    try {
      await planState.update(formData.id!, formData)
      setViewMode(null)
      onToast("Plan updated successfully.")
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Update failed")
    }
  }

  function tryDelete(planId: string) {
    const plan = plans.find((p) => p.id === planId)

    if (!plan) return

    if (
      plan.subscriberCount > 0 ||
      subscriptions.some((s) => s.plan === plan.name && s.status === "Active")
    ) {
      setDeleteBlocked(true)

      setDeleteConfirm(planId)
    } else {
      setDeleteBlocked(false)

      setDeleteConfirm(planId)
    }
  }

  function confirmDelete() {
    if (!deleteConfirm || deleteBlocked) return

    void planState
      .remove(deleteConfirm)
      .catch((error: Error) => onToast(error.message))

    setDeleteConfirm(null)

    setViewMode(null)

    onToast("Plan deleted.")
  }

  return (
    <div>
      <AdminStats>
        <AdminStatCard
          label="Plans available"
          value={plans.length.toLocaleString()}
          hint="Subscription options"
          tone="purple"
        />
        <AdminStatCard
          label="Active subscriptions"
          value={activePlanSubscriptions.length.toLocaleString()}
          hint="Across all plans"
          tone="green"
        />
        <AdminStatCard
          label="Average plan price"
          value={formatPeso(averagePlanPrice)}
          hint="Monthly catalog average"
          tone="blue"
        />
        <AdminStatCard
          label="Estimated monthly revenue"
          value={formatPeso(estimatedMonthlyRevenue)}
          hint="From active subscriptions"
          tone="gold"
        />
      </AdminStats>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
            Subscription Plans
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>
            Manage the plans available to STREAMFLIX subscribers.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="btn-primary flex items-center gap-2 px-5 py-2.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Plan
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search plans..."
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          message={
            search
              ? "No records match your search or selected filters."
              : "No subscription plans have been created yet."
          }
          showReset={!!search}
          onReset={() => setSearch("")}
        />
      ) : (
        <TableShell
          headers={[
            "Plan ID",
            "Plan Name",
            "Monthly Price",
            "Maximum Users",
            "Description",
            "Subscribers",
            "Actions",
          ]}
        >
          {filtered.map((p) => (
            <Tr
              key={p.id}
              selected={selectedId === p.id && viewMode === "view"}
              onClick={() => {
                setSelectedId(p.id)
                setViewMode("view")
              }}
            >
              <Td
                style={{
                  color: "#9CA3AF",
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              >
                {p.id}
              </Td>
              <Td style={{ fontWeight: 600 }}>{p.name}</Td>
              <Td style={{ color: "#F5A800", fontWeight: 600 }}>
                ₱{p.price.toLocaleString()}/mo
              </Td>
              <Td style={{ color: "#9CA3AF" }}>{p.maxUsers}</Td>
              <Td style={{ color: "#9CA3AF", maxWidth: 240 }}>
                <span
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.description}
                </span>
              </Td>
              <Td style={{ color: "#9CA3AF" }}>
                {p.subscriberCount.toLocaleString()}
              </Td>
              <Td>
                <div
                  className="content-table__actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AdminRowAction
                    action="view"
                    name={p.name || `plan ${p.id}`}
                    onClick={() => {
                      setSelectedId(p.id)
                      setViewMode("view")
                    }}
                  />
                  <AdminRowAction action="edit" name={p.name || `plan ${p.id}`} onClick={() => openEdit(p)} />
                  <AdminRowAction action="delete" name={p.name || `plan ${p.id}`} onClick={() => tryDelete(p.id)} />
                </div>
              </Td>
            </Tr>
          ))}
        </TableShell>
      )}

      {/* View Plan */}
      {selected && viewMode === "view" && (
        <Panel
          title="Plan Details"
          onClose={() => setViewMode(null)}
          width={400}
        >
          <DetailRow label="Plan ID" value={selected.id} mono />
          <DetailRow label="Plan Name" value={selected.name} />
          <DetailRow
            label="Monthly Price"
            value={`₱${selected.price.toLocaleString()}`}
          />
          <DetailRow label="Maximum Users" value={String(selected.maxUsers)} />
          <DetailRow label="Description" value={selected.description} />
          <DetailRow
            label="Subscribers"
            value={selected.subscriberCount.toLocaleString()}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <VioletBtn onClick={() => setViewMode(null)}>Close</VioletBtn>
            <GoldBtn onClick={() => openEdit(selected)}>Edit Plan</GoldBtn>
          </div>
        </Panel>
      )}

      {/* Add Plan */}
      {viewMode === "add" && (
        <Panel title="Add Plan" onClose={() => setViewMode(null)} width={460}>
          <FormField label="Plan Name" error={errors.name}>
            <TextInput
              value={formData.name || ""}
              onChange={(v) => setFormData((d) => ({ ...d, name: v }))}
            />
          </FormField>
          <FormField label="Monthly Price (₱)" error={errors.price as string}>
            <TextInput
              value={String(formData.price || "")}
              onChange={(v) => setFormData((d) => ({ ...d, price: Number(v) }))}
              type="number"
            />
          </FormField>
          <FormField label="Maximum Users" error={errors.maxUsers as string}>
            <TextInput
              value={String(formData.maxUsers || "")}
              onChange={(v) =>
                setFormData((d) => ({ ...d, maxUsers: Number(v) }))
              }
              type="number"
            />
          </FormField>
          <FormField label="Plan Description">
            <TextInput
              value={formData.description || ""}
              onChange={(v) => setFormData((d) => ({ ...d, description: v }))}
            />
          </FormField>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <VioletBtn onClick={() => setViewMode(null)} style={{ flex: 1 }}>
              Cancel
            </VioletBtn>
            <button
              type="button"
              onClick={saveAdd}
              className="btn-primary flex items-center justify-center gap-2 px-5 py-2.5"
              style={{ flex: 1 }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Plan
            </button>
          </div>
        </Panel>
      )}

      {/* Edit Plan */}
      {viewMode === "edit" && selected && (
        <Panel title="Edit Plan" onClose={() => setViewMode(null)} width={460}>
          <FormField label="Plan ID">
            <TextInput value={formData.id || ""} readOnly />
          </FormField>
          <FormField label="Plan Name" error={errors.name}>
            <TextInput
              value={formData.name || ""}
              onChange={(v) => setFormData((d) => ({ ...d, name: v }))}
            />
          </FormField>
          <FormField label="Monthly Price (₱)" error={errors.price as string}>
            <TextInput
              value={String(formData.price || "")}
              onChange={(v) => setFormData((d) => ({ ...d, price: Number(v) }))}
              type="number"
            />
          </FormField>
          <FormField label="Maximum Users" error={errors.maxUsers as string}>
            <TextInput
              value={String(formData.maxUsers || "")}
              onChange={(v) =>
                setFormData((d) => ({ ...d, maxUsers: Number(v) }))
              }
              type="number"
            />
          </FormField>
          <FormField label="Plan Description">
            <TextInput
              value={formData.description || ""}
              onChange={(v) => setFormData((d) => ({ ...d, description: v }))}
            />
          </FormField>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <VioletBtn onClick={() => setViewMode(null)} style={{ flex: 1 }}>
              Cancel
            </VioletBtn>
            <DangerBtn onClick={() => tryDelete(selected.id)}>
              Delete Plan
            </DangerBtn>
            <GoldBtn onClick={() => void saveEdit()} disabled={planState.mutating} style={{ flex: 1 }}>
              {planState.mutating ? "Saving…" : "Save Changes"}
            </GoldBtn>
          </div>
        </Panel>
      )}

      {deleteConfirm &&
        (deleteBlocked ? (
          <ConfirmDialog
            heading="Cannot delete plan"
            message="This plan is currently assigned to subscriptions. Reassign the affected subscriptions before deleting it."
            onCancel={() => setDeleteConfirm(null)}
            onConfirm={() => setDeleteConfirm(null)}
            confirmLabel="OK"
          />
        ) : (
          <ConfirmDialog
            heading="Delete plan?"
            message="This plan will be permanently removed. This action cannot be undone."
            onCancel={() => setDeleteConfirm(null)}
            onConfirm={confirmDelete}
            confirmLabel="Delete Plan"
            danger
          />
        ))}
    </div>
  )
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

function PaymentsTab({ onToast }: { onToast: (m: string) => void }) {
  const paymentState = useAdminCollection(
    useAdminRepository<Payment>("payments"),
  )

  const payments = paymentState.items

  const [search, setSearch] = useState("")

  const [methodFilter, setMethodFilter] = useState("All Payment Methods")

  const [statusFilter, setStatusFilter] = useState("All Payment Statuses")

  const [sort, setSort] = useState("Newest First")

  const [page, setPage] = useState(1)

  const [perPage, setPerPage] = useState(10)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [verifyMode, setVerifyMode] = useState(false)

  const [newStatus, setNewStatus] = useState<PayStatus>("Paid")

  const [confirm, setConfirm] = useState(false)

  const filtered = payments
    .filter((p) => {
      const q = search.toLowerCase()

      if (
        q &&
        !`${p.id} ${p.subscriptionId} ${p.subscriberName} ${p.reference}`
          .toLowerCase()
          .includes(q)
      )
        return false

      if (methodFilter !== "All Payment Methods" && p.method !== methodFilter)
        return false

      if (statusFilter !== "All Payment Statuses" && p.status !== statusFilter)
        return false

      return true
    })
    .sort((a, b) => {
      if (sort === "Newest First")
        return b.paymentDate.localeCompare(a.paymentDate)

      if (sort === "Oldest First")
        return a.paymentDate.localeCompare(b.paymentDate)

      if (sort === "Highest Amount") return b.amount - a.amount

      if (sort === "Lowest Amount") return a.amount - b.amount

      return 0
    })

  const paged = filtered.slice((page - 1) * perPage, page * perPage)

  const selected = payments.find((p) => p.id === selectedId) ?? null

  const paidPayments = payments.filter((payment) => payment.status === "Paid")
  const pendingPayments = payments.filter(
    (payment) => payment.status === "Pending",
  )
  const failedPayments = payments.filter(
    (payment) => payment.status === "Failed",
  )
  const collectedRevenue = paidPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  )
  const pendingAmount = pendingPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  )

  function showPaymentStatus(status: PayStatus | "All") {
    setStatusFilter(status === "All" ? "All Payment Statuses" : status)
    setPage(1)
  }

  function openVerify(p: Payment) {
    setSelectedId(p.id)

    setNewStatus(p.status)

    setVerifyMode(true)
  }

  function submitVerify() {
    if (newStatus === "Paid") {
      setConfirm(true)
    } else {
      applyVerify()
    }
  }

  function applyVerify() {
    if (!selectedId) return

    void paymentState
      .update(selectedId, { status: newStatus })
      .catch((error: Error) => onToast(error.message))

    setVerifyMode(false)

    setConfirm(false)

    onToast("Payment status updated successfully.")
  }

  return (
    <div>
      <AdminStats>
        <AdminStatCard
          label="Total payments"
          value={payments.length.toLocaleString()}
          hint="All payment records"
          tone="purple"
          active={statusFilter === "All Payment Statuses"}
          onClick={() => showPaymentStatus("All")}
          actionLabel="Show all payments"
        />
        <AdminStatCard
          label="Collected revenue"
          value={formatPeso(collectedRevenue)}
          hint={`${paidPayments.length.toLocaleString()} paid transactions`}
          tone="green"
          active={statusFilter === "Paid"}
          onClick={() => showPaymentStatus("Paid")}
          actionLabel="Filter to paid transactions"
        />
        <AdminStatCard
          label="Pending amount"
          value={formatPeso(pendingAmount)}
          hint={`${pendingPayments.length.toLocaleString()} awaiting verification`}
          tone="gold"
          active={statusFilter === "Pending"}
          onClick={() => showPaymentStatus("Pending")}
          actionLabel="Filter to pending payments"
        />
        <AdminStatCard
          label="Failed payments"
          value={failedPayments.length.toLocaleString()}
          hint="Require follow-up"
          tone="red"
          active={statusFilter === "Failed"}
          onClick={() => showPaymentStatus("Failed")}
          actionLabel="Filter to failed payments"
        />
      </AdminStats>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
          Payments
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>
          Review and verify STREAMFLIX subscription payments.
        </p>
      </div>
      <div
        style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}
      >
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search payments..."
        />
        <Select
          value={methodFilter}
          onChange={(v) => {
            setMethodFilter(v)
            setPage(1)
          }}
          options={[
            "All Payment Methods",
            "GCash",
            "Maya",
            "Credit Card",
            "Debit Card",
            "Online Banking",
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          options={["All Payment Statuses", "Paid", "Pending", "Failed"]}
        />
        <Select
          value="All Payment Dates"
          onChange={() => {}}
          options={["All Payment Dates"]}
        />
        <Select
          value={sort}
          onChange={(v) => {
            setSort(v)
            setPage(1)
          }}
          options={[
            "Newest First",
            "Oldest First",
            "Highest Amount",
            "Lowest Amount",
          ]}
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyState message="No payment records are available." />
      ) : (
        <>
          <TableShell
            headers={[
              "Payment ID",
              "Subscription ID",
              "Subscriber",
              "Amount",
              "Method",
              "Reference",
              "Payment Date",
              "Status",
              "Actions",
            ]}
          >
            {paged.map((p) => (
              <Tr
                key={p.id}
                selected={selectedId === p.id}
                onClick={() => setSelectedId(p.id)}
              >
                <Td
                  style={{
                    color: "#9CA3AF",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {p.id}
                </Td>
                <Td
                  style={{
                    color: "#9CA3AF",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {p.subscriptionId}
                </Td>
                <Td style={{ fontWeight: 500 }}>{p.subscriberName}</Td>
                <Td style={{ color: "#F5A800", fontWeight: 600 }}>
                  ₱{p.amount.toLocaleString()}
                </Td>
                <Td style={{ color: "#9CA3AF" }}>{p.method}</Td>
                <Td
                  style={{
                    color: "#9CA3AF",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {p.reference}
                </Td>
                <Td style={{ color: "#9CA3AF", whiteSpace: "nowrap" }}>
                  {p.paymentDate}
                </Td>
                <Td>
                  <StatusBadge status={p.status} />
                </Td>
                <Td>
                  <div
                    style={{ display: "flex", gap: 6 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AdminRowAction action="view" name={`payment ${p.id}`} onClick={() => {
                      setSelectedId(p.id)
                      setVerifyMode(false)
                    }} />
                    <button
                      type="button"
                      className="content-table__action user-payment-verify-action"
                      onClick={() => openVerify(p)}
                      aria-label={`Verify payment ${p.id}`}
                      title="Verify payment"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3 5 6v5c0 4.6 2.8 7.9 7 10 4.2-2.1 7-5.4 7-10V6l-7-3Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m9 12 2 2 4-4" />
                      </svg>
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </TableShell>
          <Pagination
            total={filtered.length}
            page={page}
            perPage={perPage}
            onPage={setPage}
            onPerPage={(amount) => {
              setPerPage(amount)
              setPage(1)
            }}
            label="payments"
          />
        </>
      )}

      {/* Payment Details */}
      {selected && !verifyMode && (
        <Panel
          title="Payment Details"
          onClose={() => setSelectedId(null)}
          width={420}
        >
          <DetailRow label="Payment ID" value={selected.id} mono />
          <DetailRow
            label="Subscription ID"
            value={selected.subscriptionId}
            mono
          />
          <DetailRow label="Subscriber ID" value={selected.subscriberId} mono />
          <DetailRow label="Subscriber" value={selected.subscriberName} />
          <DetailRow
            label="Amount"
            value={`₱${selected.amount.toLocaleString()}`}
          />
          <DetailRow label="Payment Method" value={selected.method} />
          <DetailRow label="Reference Number" value={selected.reference} />
          <DetailRow label="Payment Date" value={selected.paymentDate} />
          <div style={{ marginBottom: 12 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Payment Status
            </span>
            <div style={{ marginTop: 6 }}>
              <StatusBadge status={selected.status} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <VioletBtn onClick={() => setSelectedId(null)} style={{ flex: 1 }}>
              Close
            </VioletBtn>
            <GoldBtn onClick={() => openVerify(selected)} style={{ flex: 1 }}>
              Verify Payment
            </GoldBtn>
          </div>
        </Panel>
      )}

      {/* Verify Payment */}
      {selected && verifyMode && (
        <Panel
          title="Verify Payment"
          onClose={() => setVerifyMode(false)}
          width={420}
        >
          <DetailRow label="Payment ID" value={selected.id} mono />
          <DetailRow label="Subscriber" value={selected.subscriberName} />
          <DetailRow
            label="Amount"
            value={`₱${selected.amount.toLocaleString()}`}
          />
          <DetailRow label="Reference Number" value={selected.reference} />
          <DetailRow label="Payment Date" value={selected.paymentDate} />
          <FormField label="Update Payment Status">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as PayStatus)}
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "var(--color-ink)",
                border: "1px solid #374151",
                borderRadius: 6,
                color: "#fff",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              {(["Paid", "Pending", "Failed"] as PayStatus[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <VioletBtn onClick={() => setVerifyMode(false)} style={{ flex: 1 }}>
              Cancel
            </VioletBtn>
            <GoldBtn onClick={submitVerify} style={{ flex: 1 }}>
              Confirm Verification
            </GoldBtn>
          </div>
        </Panel>
      )}

      {confirm && (
        <ConfirmDialog
          heading="Confirm payment verification?"
          message="Verify that the payment details and reference number are correct before marking this payment as Paid."
          onCancel={() => setConfirm(false)}
          onConfirm={applyVerify}
          confirmLabel="Confirm Verification"
        />
      )}
    </div>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

// ─── User Management Section ──────────────────────────────────────────────────

// ─── Subscription Management Section ─────────────────────────────────────────

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function UserManagerView() {
  const [tab, setTab] =
    useState<"subscribers" | "subscriptions" | "plans" | "payments">(
      "subscribers",
    )

  const [focusSubId, setFocusSubId] = useState<string | null>(null)

  const [toast, setToast] = useState<string | null>(null)

  function navigateToSubscription(subId: string) {
    setFocusSubId(subId)

    setTab("subscriptions")
  }

  return (
    <div className="admin-page-shell users-workspace">
      <AdminPageHeader
        eyebrow="Subscriber operations"
        title="User Management"
        description="Manage subscriber accounts, plans, subscriptions, and payment verification."
      />

      <AdminWorkspaceTabs
        tabs={[
          { id: "subscribers", label: "Subscribers" },

          { id: "subscriptions", label: "Subscriptions" },

          { id: "plans", label: "Plans" },

          { id: "payments", label: "Payments" },
        ]}
        active={tab}
        onChange={(next) => {
          setTab(next)
          if (next !== "subscriptions") setFocusSubId(null)
        }}
        label="User management sections"
      />

      {tab === "subscribers" && (
        <SubscribersTab
          onToast={setToast}
          navigateToSubscription={navigateToSubscription}
        />
      )}
      {tab === "subscriptions" && (
        <SubscriptionsTab focusId={focusSubId} />
      )}
      {tab === "plans" && <PlansTab onToast={setToast} />}
      {tab === "payments" && <PaymentsTab onToast={setToast} />}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
