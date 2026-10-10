import { useState, useMemo } from "react";
import {
  useAdminCollection,
  useAdminRepository,
} from "../../data";
import { AdminRowAction, AdminStatCard, AdminStats } from "../../components/AdminUI";
import {
  StatusBadge,
  statusVariantFor,
  SearchInput,
  Select,
  Pagination,
  EmptyRow,
  Drawer,
  Modal,
  DetailRow,
  AdminDetailGrid,
  AdminDetailsSection,
  SectionTitle,
  Spinner,
} from "./shared";

interface SecurityEvent {
  id: string;
  dateTime: string;
  eventType: string;
  userSource: string;
  ip: string;
  description: string;
  severity: string;
  status: string;
}

type SecurityAction = "resolve" | "monitor" | "false-positive";


const TYPE_OPTIONS = [
  { value: "all", label: "All Security Events" },
  { value: "Failed Login", label: "Failed Login" },
  { value: "Suspicious Login", label: "Suspicious Login" },
  { value: "Permission Change", label: "Permission Change" },
  { value: "Unauthorized Access Attempt", label: "Unauthorized Access" },
  { value: "Security Scan", label: "Security Scan" },
  { value: "Configuration Change", label: "Configuration Change" },
];

const SEV_OPTIONS = [
  { value: "all", label: "All Severities" },
  { value: "Info", label: "Info" },
  { value: "Warning", label: "Warning" },
  { value: "Critical", label: "Critical" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "New", label: "New" },
  { value: "Monitoring", label: "Monitoring" },
  { value: "Resolved", label: "Resolved" },
  { value: "False Positive", label: "False Positive" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "sev-high", label: "Highest Severity" },
  { value: "sev-low", label: "Lowest Severity" },
];

const SEV_ORDER: Record<string, number> = { Critical: 3, Warning: 2, Info: 1 };

const SECURITY_COLUMNS = [
  { label: "Event ID", className: "security-col-id" },
  { label: "Date & Time", className: "security-col-date" },
  { label: "Event Type", className: "security-col-type" },
  { label: "User / Source", className: "security-col-source" },
  { label: "IP Address", className: "security-col-ip" },
  { label: "Description", className: "security-col-description" },
  { label: "Severity", className: "security-col-severity" },
  { label: "Status", className: "security-col-status" },
  { label: "Actions", className: "security-col-actions" },
];

export default function SecurityTab() {
  const logState = useAdminCollection(
    useAdminRepository<SecurityEvent>("system-logs"),
  );
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSev, setFilterSev] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [viewEvent, setViewEvent] = useState<SecurityEvent | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ event: SecurityEvent; action: SecurityAction } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");

  const [showScanConfirm, setShowScanConfirm] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanDone, setScanDone] = useState(false);

  const events = useMemo(
    () =>
      logState.items
        .filter(
          (event) =>
            event.eventType.toLowerCase().includes("security") ||
            event.eventType.toLowerCase().includes("login") ||
            event.severity === "Critical",
        )
        .map((event) =>
          pendingStatuses[event.id]
            ? { ...event, status: pendingStatuses[event.id] }
            : event,
        ),
    [logState.items, pendingStatuses],
  );

  const filtered = useMemo(() => {
    let list = events.filter((e) => {
      const q = search.toLowerCase();
      const matchQ = !q || e.id.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.eventType.toLowerCase().includes(q) || e.userSource.toLowerCase().includes(q);
      const matchType = filterType === "all" || e.eventType === filterType;
      const matchSev = filterSev === "all" || e.severity === filterSev;
      const matchStatus = filterStatus === "all" || e.status === filterStatus;
      return matchQ && matchType && matchSev && matchStatus;
    });
    if (sort === "oldest") list = [...list].reverse();
    else if (sort === "sev-high") list = [...list].sort((a, b) => (SEV_ORDER[b.severity] || 0) - (SEV_ORDER[a.severity] || 0));
    else if (sort === "sev-low") list = [...list].sort((a, b) => (SEV_ORDER[a.severity] || 0) - (SEV_ORDER[b.severity] || 0));
    return list;
  }, [events, search, filterType, filterSev, filterStatus, sort]);

  function resetFilters() {
    setSearch(""); setFilterType("all"); setFilterSev("all"); setFilterStatus("all"); setSort("newest"); setPage(1);
  }

  function statusForAction(action: SecurityAction) {
    return action === "resolve"
      ? "Resolved"
      : action === "monitor"
        ? "Monitoring"
        : "False Positive";
  }

  async function persistStatus(event: SecurityEvent, action: SecurityAction) {
    const newStatus = statusForAction(action);
    setActionError("");
    setPendingStatuses((current) => ({ ...current, [event.id]: newStatus }));
    setViewEvent((current) =>
      current?.id === event.id ? { ...current, status: newStatus } : current,
    );

    try {
      await logState.update(event.id, { status: newStatus });
    } catch (reason) {
      setViewEvent((current) =>
        current?.id === event.id ? { ...current, status: event.status } : current,
      );
      setActionError(
        reason instanceof Error
          ? reason.message
          : `Could not mark security event ${event.id} as ${newStatus}.`,
      );
      throw reason;
    } finally {
      setPendingStatuses((current) => {
        const next = { ...current };
        delete next[event.id];
        return next;
      });
    }
  }

  function applyAction(event: SecurityEvent, action: SecurityAction) {
    // require confirm for critical resolved / false positive
    if ((event.severity === "Critical" && action === "resolve") || action === "false-positive") {
      setConfirmAction({ event, action });
      return;
    }
    void persistStatus(event, action).catch(() => undefined);
  }

  async function confirmApply() {
    if (!confirmAction) return;
    const requestedAction = confirmAction;
    setActionLoading(true);
    try {
      await persistStatus(requestedAction.event, requestedAction.action);
      setConfirmAction(null);
    } catch {
      // The inline error keeps the failed action visible and available to retry.
    } finally {
      setActionLoading(false);
    }
  }

  function startScan() {
    setShowScanConfirm(false);
    setScanning(true);
    setScanProgress(100);
    setScanDone(true);
    void logState.create({
      dateTime: new Date().toLocaleString(),
      eventType: "Security Scan",
      userSource: "Current administrator",
      ip: "",
      description: "Manual security review recorded from the admin portal",
      severity: "Info",
      status: "Completed",
    }).finally(() => setScanning(false));
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  const criticalCount = events.filter((e) => e.severity === "Critical" && e.status === "New").length;
  const failedLogins = events.filter((e) => e.eventType === "Failed Login").length;
  const newAlertCount = events.filter((e) => e.status === "New").length;

  return (
    <div>
      <SectionTitle title="Security Monitoring" description="Review security events, access attempts, and potential threats." />

      <AdminStats>
        <AdminStatCard label="Security events" value={events.length} hint="All monitored events" tone="purple" active={filterSev === "all" && filterStatus === "all"} onClick={() => { setFilterSev("all"); setFilterStatus("all"); setPage(1); }} actionLabel="Show all security events" />
        <AdminStatCard label="Critical open" value={criticalCount} hint="Critical events marked new" tone="red" active={filterSev === "Critical" && filterStatus === "New"} onClick={() => { setFilterSev("Critical"); setFilterStatus("New"); setPage(1); }} actionLabel="Filter to critical open events" />
        <AdminStatCard label="New alerts" value={newAlertCount} hint="Awaiting review" tone="gold" active={filterStatus === "New" && filterSev === "all"} onClick={() => { setFilterSev("all"); setFilterStatus("New"); setPage(1); }} actionLabel="Filter to new alerts" />
        <AdminStatCard label="Latest security scan" value={events.find(event => event.eventType === "Security Scan")?.dateTime ?? "No record"} hint={`${failedLogins} failed login event${failedLogins === 1 ? "" : "s"}`} tone="blue" />
      </AdminStats>

      {/* Scan progress */}
      {scanning && (
        <div className="mb-4 card-surface p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white font-medium flex items-center gap-2">
              {!scanDone && <Spinner size={14} />}
              {scanDone ? "Security scan complete — no threats detected." : "Running security scan…"}
            </span>
            <span className="text-[#9CA3AF]">{Math.round(scanProgress)}%</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${scanProgress}%`, background: scanDone ? "#10b981" : "#7C3AED" }} />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="admin-filter-row security-toolbar mb-4" role="search" aria-label="Search and filter security events">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search security events..." className="security-toolbar__search" />
        <Select value={filterType} onChange={(v) => { setFilterType(v); setPage(1); }} options={TYPE_OPTIONS} className="security-toolbar__type" />
        <Select value={filterSev} onChange={(v) => { setFilterSev(v); setPage(1); }} options={SEV_OPTIONS} className="security-toolbar__select" />
        <Select value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(1); }} options={STATUS_OPTIONS} className="security-toolbar__select" />
        <Select value={sort} onChange={(v) => { setSort(v); setPage(1); }} options={SORT_OPTIONS} className="security-toolbar__sort" />
        <div className="security-toolbar__actions">
          <button type="button" onClick={resetFilters} className="btn-violet focus-ring admin-reset-filters">Reset Filters</button>
          <button type="button" onClick={() => setShowScanConfirm(true)} className="btn-outline security-toolbar__scan focus-ring">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Run Security Scan
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-red-500/35 bg-red-950/25 px-4 py-3 text-sm text-red-200" role="alert">
          <span>Security status update failed: {actionError}</span>
          <button type="button" onClick={() => setActionError("")} className="shrink-0 font-semibold text-red-100 hover:text-white">Dismiss</button>
        </div>
      )}

      <div className="table-surface">
        <div className="security-table-frame">
          <table className="system-security-table text-sm" aria-label="Security Events">
            <thead>
              <tr className="border-b border-stone-700/60">
                {SECURITY_COLUMNS.map((column) => (
                  <th key={column.label} className={`${column.className} text-left text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider${column.label === "User / Source" ? " admin-table-head--emphasis" : ""}`} scope="col">{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyRow cols={9} message="No security events are available." />
              ) : (
                pageRows.map((ev) => (
                  <tr key={ev.id} className="tr-hover border-b border-stone-700/30 last:border-0">
                    <td className="security-col-id font-mono text-xs text-[#9CA3AF]" title={ev.id}>{ev.id}</td>
                    <td className="security-col-date text-[#9CA3AF] text-xs" title={ev.dateTime}>{ev.dateTime}</td>
                    <td className="security-col-type text-white text-xs" title={ev.eventType}>{ev.eventType}</td>
                    <td className="security-col-source text-[#9CA3AF] text-xs" title={ev.userSource}>{ev.userSource}</td>
                    <td className="security-col-ip font-mono text-xs text-[#9CA3AF]" title={ev.ip}>{ev.ip}</td>
                    <td className="security-col-description text-[#9CA3AF] text-xs" title={ev.description}>{ev.description}</td>
                    <td className="security-col-severity">
                      <StatusBadge label={ev.severity} variant={statusVariantFor(ev.severity)} />
                    </td>
                    <td className="security-col-status">
                      <StatusBadge label={ev.status} variant={statusVariantFor(ev.status)} />
                    </td>
                    <td className="security-col-actions">
                      <div className="content-table__actions security-table-actions">
                        <AdminRowAction action="view" name={`security event ${ev.id}`} onClick={() => setViewEvent(ev)} />
                        {ev.status !== "Resolved" && ev.status !== "False Positive" && (
                          <button
                            type="button"
                            onClick={() => applyAction(ev, "resolve")}
                            disabled={Boolean(pendingStatuses[ev.id])}
                            className="content-table__action security-action--resolve"
                            aria-label={`Resolve security event ${ev.id}`}
                            title="Mark as resolved"
                          >
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 12 4 4L19 6" />
                            </svg>
                          </button>
                        )}
                        {ev.status !== "False Positive" && (
                          <button type="button" onClick={() => applyAction(ev, "false-positive")} disabled={Boolean(pendingStatuses[ev.id])} className="content-table__action security-action--false-positive" aria-label={`Mark security event ${ev.id} as false positive`} title="Mark as false positive">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <circle cx="12" cy="12" r="8" strokeWidth={2} />
                              <path strokeLinecap="round" strokeWidth={2} d="m9 9 6 6m0-6-6 6" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={safePage} total={filtered.length} perPage={perPage} onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }} label="security events" />
      </div>

      {/* Event detail drawer */}
      <Drawer
        open={!!viewEvent}
        onClose={() => setViewEvent(null)}
        title="Security Event Details"
        footer={
          viewEvent && viewEvent.status !== "Monitoring" && viewEvent.status !== "Resolved" && viewEvent.status !== "False Positive" ? (
            <button onClick={() => { applyAction(viewEvent, "monitor"); setViewEvent(null); }} className="admin-details-button admin-details-button--secondary">Mark Monitoring</button>
          ) : undefined
        }
      >
        {viewEvent && (
          <>
            <AdminDetailsSection title="Event Information">
              <AdminDetailGrid>
                <DetailRow label="Event ID" value={<span className="font-mono">{viewEvent.id}</span>} />
                <DetailRow label="Date & Time" value={viewEvent.dateTime} />
                <DetailRow label="Event Type" value={viewEvent.eventType} />
                <DetailRow label="Source" value={viewEvent.userSource} />
                <DetailRow label="IP Address" value={<span className="font-mono">{viewEvent.ip}</span>} />
                <DetailRow label="Severity" value={<StatusBadge label={viewEvent.severity} variant={statusVariantFor(viewEvent.severity)} />} />
                <DetailRow label="Status" value={<StatusBadge label={viewEvent.status} variant={statusVariantFor(viewEvent.status)} />} />
              </AdminDetailGrid>
              <DetailRow label="Description" value={viewEvent.description} />
            </AdminDetailsSection>
            <AdminDetailsSection title="Technical Details">
              <pre className="admin-details-code-block">
                {`event_id: ${viewEvent.id}
timestamp: ${viewEvent.dateTime}
source: ${viewEvent.userSource}
event_type: ${viewEvent.eventType}
severity: ${viewEvent.severity}
ip_address: ${viewEvent.ip}
user_agent: Mozilla/5.0 (compatible)
geo: Unknown
attempts: ${Math.floor(Math.random() * 10) + 1}`}
              </pre>
            </AdminDetailsSection>
          </>
        )}
      </Drawer>

      {/* Confirm action modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.action === "false-positive" ? "Mark as False Positive?" : "Mark as Resolved?"}
        footer={
          <>
            <button onClick={() => setConfirmAction(null)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
            <button onClick={confirmApply} disabled={actionLoading} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
              {actionLoading && <Spinner size={14} />}
              Confirm
            </button>
          </>
        }
      >
        <p className="text-sm text-[#9CA3AF] leading-relaxed">
          {confirmAction?.action === "false-positive"
            ? `Mark security event ${confirmAction?.event.id} as a false positive? This action indicates the event does not represent a real threat.`
            : `Mark critical security event ${confirmAction?.event.id} as resolved? Ensure the underlying issue has been fully addressed before confirming.`}
        </p>
      </Modal>

      {/* Scan confirm */}
      <Modal
        open={showScanConfirm}
        onClose={() => setShowScanConfirm(false)}
        title="Run security scan?"
        footer={
          <>
            <button onClick={() => setShowScanConfirm(false)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
            <button onClick={startScan} className="btn-primary px-4 py-2 text-sm">Start Scan</button>
          </>
        }
      >
        <p className="text-sm text-[#9CA3AF] leading-relaxed">
          The scan will check system configurations, authentication activity, and potential security threats. This may take a few minutes.
        </p>
      </Modal>
    </div>
  );
}
