import { useState, useMemo } from 'react';
import type { Soundtrack, Content, Toast } from '../../types';
import Modal from '../shared/Modal';
import ConfirmDialog from '../shared/ConfirmDialog';
import { AdminRowAction } from '../../../components/AdminUI';

interface SoundtracksTabProps {
  soundtracks: Soundtrack[];
  content: Content[];
  onAdd: (s: Omit<Soundtrack, 'id'>) => void;
  onEdit: (s: Soundtrack) => Promise<void>;
  onDelete: (id: string) => void;
  addToast: (msg: string, type: Toast['type']) => void;
}

const inputClass = "w-full px-3 py-2 rounded-lg text-sm text-white placeholder-[#9CA3AF] outline-none focus:ring-1 focus:ring-[#7C3AED] transition-colors";
const inputStyle = { backgroundColor: 'var(--color-ink)', border: '1px solid #374151' };

type SForm = Omit<Soundtrack, 'id'>;
const emptyForm: SForm = { contentId: '', songTitle: '', artist: '', lyrics: '', timestamp: '', streamingLink: '' };

type SErrors = Partial<Record<keyof SForm, string>>;

function validateS(f: SForm): SErrors {
  const e: SErrors = {};
  if (!f.contentId) e.contentId = 'Associated content is required.';
  if (!f.songTitle.trim()) e.songTitle = 'Song title is required.';
  if (!f.artist.trim()) e.artist = 'Artist is required.';
  if (f.timestamp && !/^\d{2}:\d{2}:\d{2}$/.test(f.timestamp)) e.timestamp = 'Use format HH:MM:SS.';
  if (f.streamingLink && !/^https?:\/\//.test(f.streamingLink)) {
    e.streamingLink = 'Enter a valid URL starting with http(s)://.';
  } else if (f.streamingLink) {
    try {
      const hostname = new URL(f.streamingLink).hostname.toLowerCase();
      if (hostname === 'youtu.be' || hostname.endsWith('youtube.com')) {
        e.streamingLink = 'Use a direct audio file URL. YouTube page URLs cannot play as audio-only.';
      }
    } catch {
      e.streamingLink = 'Enter a valid direct audio URL.';
    }
  }
  return e;
}

function SoundtrackForm({
  initial, content, onSubmit, onCancel, submitLabel, readOnlyId,
}: {
  initial: SForm; content: Content[]; onSubmit: (f: SForm) => void | Promise<void>; onCancel: () => void; submitLabel: string; readOnlyId?: string;
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<SErrors>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SForm>(k: K, v: SForm[K]) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateS(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {readOnlyId && <div className="mb-4 p-2.5 rounded-lg text-xs font-mono" style={{ backgroundColor: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: '#8B5CF6' }}>{readOnlyId}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="sm:col-span-2">
          <label htmlFor="stk-cnt" className="block text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>Associated Content <span style={{ color: '#EF4444' }}>*</span></label>
          <select id="stk-cnt" value={form.contentId} onChange={(e) => set('contentId', e.target.value)} className={inputClass} style={{ ...inputStyle, borderColor: errors.contentId ? '#EF4444' : '#374151' }}>
            <option value="">Select content</option>
            {content.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.id})</option>)}
          </select>
          {errors.contentId && <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>{errors.contentId}</p>}
        </div>
        <div>
          <label htmlFor="stk-title" className="block text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>Song Title <span style={{ color: '#EF4444' }}>*</span></label>
          <input id="stk-title" type="text" value={form.songTitle} onChange={(e) => set('songTitle', e.target.value)} placeholder="Song title" className={inputClass} style={{ ...inputStyle, borderColor: errors.songTitle ? '#EF4444' : '#374151' }} />
          {errors.songTitle && <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>{errors.songTitle}</p>}
        </div>
        <div>
          <label htmlFor="stk-artist" className="block text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>Artist <span style={{ color: '#EF4444' }}>*</span></label>
          <input id="stk-artist" type="text" value={form.artist} onChange={(e) => set('artist', e.target.value)} placeholder="Artist name" className={inputClass} style={{ ...inputStyle, borderColor: errors.artist ? '#EF4444' : '#374151' }} />
          {errors.artist && <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>{errors.artist}</p>}
        </div>
        <div>
          <label htmlFor="stk-ts" className="block text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>Timestamp (HH:MM:SS)</label>
          <input id="stk-ts" type="text" value={form.timestamp} onChange={(e) => set('timestamp', e.target.value)} placeholder="00:04:22" className={inputClass} style={{ ...inputStyle, borderColor: errors.timestamp ? '#EF4444' : '#374151' }} />
          {errors.timestamp && <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>{errors.timestamp}</p>}
        </div>
        <div>
          <label htmlFor="stk-link" className="block text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>Direct Audio URL</label>
          <input id="stk-link" type="url" value={form.streamingLink} onChange={(e) => set('streamingLink', e.target.value)} placeholder="https://…/soundtrack.mp3" aria-describedby="stk-link-help" className={inputClass} style={{ ...inputStyle, borderColor: errors.streamingLink ? '#EF4444' : '#374151' }} />
          <p id="stk-link-help" className="mt-1 text-xs" style={{ color: '#6B7280' }}>Use a direct MP3, AAC, OGG, WAV, or WebM audio file URL—not a YouTube page URL.</p>
          {errors.streamingLink && <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>{errors.streamingLink}</p>}
        </div>
      </div>
      <div className="mb-6">
        <label htmlFor="stk-lyrics" className="block text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>Lyrics or Lyrics Snippet</label>
        <textarea id="stk-lyrics" rows={3} value={form.lyrics} onChange={(e) => set('lyrics', e.target.value)} placeholder="Lyrics..." className={`${inputClass} resize-none`} style={inputStyle} />
      </div>
      <div className="flex justify-end gap-3" style={{ borderTop: '1px solid #374151', paddingTop: '1.25rem' }}>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ border: '1px solid #374151', color: '#9CA3AF', backgroundColor: 'transparent' }}>Cancel</button>
        <button type="submit" disabled={saving} aria-busy={saving || undefined} className="btn-primary flex items-center gap-2 px-5 py-2.5">
          {submitLabel.startsWith('Add ') && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>}
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function SoundtracksTab({ soundtracks, content, onAdd, onEdit, onDelete, addToast }: SoundtracksTabProps) {
  const [search, setSearch] = useState('');
  const [contentFilter, setContentFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let rows = soundtracks;
    if (search) rows = rows.filter((s) => s.songTitle.toLowerCase().includes(search.toLowerCase()) || s.artist.toLowerCase().includes(search.toLowerCase()));
    if (contentFilter) rows = rows.filter((s) => s.contentId === contentFilter);
    return rows;
  }, [soundtracks, search, contentFilter]);

  const editItem = editId ? soundtracks.find((s) => s.id === editId) : null;
  const deleteItem = deleteId ? soundtracks.find((s) => s.id === deleteId) : null;
  const viewItem = viewId ? soundtracks.find((s) => s.id === viewId) : null;
  const getContentTitle = (id: string) => content.find((c) => c.id === id)?.title ?? id;

  const thStyle: React.CSSProperties = { color: '#9CA3AF', padding: '10px 12px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div>
      <div className="content-admin-tab-toolbar flex flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-48 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="search" maxLength={100} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by song title or artist..." aria-label="Search soundtracks" className="w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none" style={{ backgroundColor: '#150D2A', border: '1px solid #374151', color: '#fff' }} />
        </div>
        <select value={contentFilter} onChange={(e) => setContentFilter(e.target.value)} className="content-command-bar__select" aria-label="Filter by content">
          <option value="">All Content</option>
          {content.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button onClick={() => { setSearch(''); setContentFilter(''); }} className="btn-violet focus-ring admin-reset-filters">Reset Filters</button>
        <button type="button" onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Add Soundtrack
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #374151' }}>
        <div className="content-media-table-scroll">
          <table className="content-media-table content-soundtracks-table border-collapse text-sm" style={{ backgroundColor: '#150D2A' }}>
            <colgroup>
              <col className="media-col-id" /><col className="media-col-title" /><col className="media-col-artist" /><col className="media-col-content" />
              <col className="media-col-timestamp" /><col className="media-col-actions" />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <th style={thStyle}>Soundtrack ID</th>
                <th style={thStyle}>Song Title</th>
                <th style={thStyle}>Artist</th>
                <th style={thStyle}>Associated Content</th>
                <th style={thStyle}>Timestamp</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-14 text-center text-sm" style={{ color: '#9CA3AF' }}>
                  {soundtracks.length === 0 ? 'No soundtrack entries have been added yet.' : 'No records match your search or selected filters.'}
                </td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #1F2937' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,58,237,0.05)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
                  <td className="px-3 py-3"><span className="block truncate font-mono text-xs" title={s.id} style={{ color: '#8B5CF6' }}>{s.id}</span></td>
                  <td className="px-3 py-3 font-medium text-white"><span className="block truncate" title={s.songTitle}>{s.songTitle}</span></td>
                  <td className="px-3 py-3" style={{ color: '#9CA3AF' }}><span className="block truncate" title={s.artist}>{s.artist}</span></td>
                  <td className="px-3 py-3"><span className="truncate block text-white" title={getContentTitle(s.contentId)}>{getContentTitle(s.contentId)}</span></td>
                  <td className="px-3 py-3"><span className="font-mono text-xs" style={{ color: '#F5A800' }}>{s.timestamp || '—'}</span></td>
                  <td className="px-3 py-3">
                    <div className="content-table__actions">
                      <AdminRowAction action="view" name={s.songTitle || `soundtrack ${s.id}`} onClick={() => setViewId(s.id)} />
                      <AdminRowAction action="edit" name={s.songTitle || `soundtrack ${s.id}`} onClick={() => setEditId(s.id)} />
                      <AdminRowAction action="delete" name={s.songTitle || `soundtrack ${s.id}`} onClick={() => setDeleteId(s.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewItem && (
        <Modal title="Soundtrack Details" onClose={() => setViewId(null)}>
          <div className="space-y-4">
            {[
              { label: 'Soundtrack ID', value: viewItem.id, mono: true },
              { label: 'Song Title', value: viewItem.songTitle },
              { label: 'Artist', value: viewItem.artist },
              { label: 'Associated Content', value: getContentTitle(viewItem.contentId) },
              { label: 'Timestamp', value: viewItem.timestamp || '—', mono: true },
              { label: 'Streaming Link', value: viewItem.streamingLink || '—' },
            ].map(({ label, value, mono }) => (
              <div key={label}>
                <p className="text-xs mb-0.5" style={{ color: '#9CA3AF' }}>{label}</p>
                <p className={`text-sm ${mono ? 'font-mono' : 'font-medium'} text-white break-all`}>{value}</p>
              </div>
            ))}
            {viewItem.lyrics && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#9CA3AF' }}>Lyrics</p>
                <p className="text-sm text-white whitespace-pre-line leading-relaxed" style={{ fontStyle: 'italic' }}>{viewItem.lyrics}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end mt-6 pt-4" style={{ borderTop: '1px solid #374151' }}>
            <button onClick={() => { setViewId(null); setEditId(viewItem.id); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'linear-gradient(135deg, #F5A800, #FF6B00)', color: '#1a0a00', border: 'none' }}>Edit</button>
          </div>
        </Modal>
      )}

      {showAdd && (
        <Modal title="Add Soundtrack" onClose={() => setShowAdd(false)} wide>
          <SoundtrackForm initial={emptyForm} content={content} submitLabel="Add Soundtrack" onCancel={() => setShowAdd(false)}
            onSubmit={(f) => { onAdd(f); setShowAdd(false); addToast('Soundtrack added.', 'success'); }} />
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Soundtrack" onClose={() => setEditId(null)} wide>
          <SoundtrackForm initial={{ contentId: editItem.contentId, songTitle: editItem.songTitle, artist: editItem.artist, lyrics: editItem.lyrics, timestamp: editItem.timestamp, streamingLink: editItem.streamingLink }}
            content={content} submitLabel="Save Changes" readOnlyId={editItem.id} onCancel={() => setEditId(null)}
            onSubmit={async (f) => { await onEdit({ ...editItem, ...f }); setEditId(null); addToast('Soundtrack updated.', 'success'); }} />
        </Modal>
      )}

      {deleteItem && (
        <ConfirmDialog title="Delete Soundtrack?" message={`Are you sure you want to delete "${deleteItem.songTitle}" by ${deleteItem.artist}?`}
          confirmLabel="Delete Soundtrack" onConfirm={() => { onDelete(deleteItem.id); setDeleteId(null); addToast('Soundtrack deleted.', 'success'); }}
          onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}
