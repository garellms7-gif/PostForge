import { useState, useEffect } from 'react';
import { Trash2, Check, X, Clock, Pause, Play, Filter, Edit3, RefreshCw, AlertCircle } from 'lucide-react';

function getUnifiedQueue() {
  const items = [];

  // Approval queue
  const approval = JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]');
  for (const a of approval) {
    items.push({
      ...a,
      source: 'approval',
      status: a.status === 'approved' ? 'scheduled' : a.status === 'pending' ? 'pending_approval' : a.status,
      scheduledAt: a.date,
    });
  }

  // Launch schedule
  const launch = JSON.parse(localStorage.getItem('postforge_launch_schedule') || '[]');
  for (const l of launch) {
    items.push({
      ...l,
      source: 'launch',
      status: l.status === 'pending' ? 'scheduled' : l.status === 'sent' ? 'sent' : l.status,
      scheduledAt: l.scheduledAt || l.date,
    });
  }

  // Manual schedule
  const manual = JSON.parse(localStorage.getItem('postforge_manual_schedule') || '[]');
  for (const m of manual) {
    items.push({
      id: m.id,
      community: m.community,
      platform: m.platform,
      content: '',
      source: 'manual',
      status: 'scheduled',
      scheduledAt: m.scheduledAt,
    });
  }

  // Sort by scheduled time
  items.sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));
  return items;
}

function getQueuePaused() {
  return localStorage.getItem('postforge_queue_paused') === 'true';
}

function setQueuePaused(paused) {
  localStorage.setItem('postforge_queue_paused', paused ? 'true' : 'false');
}

export function isQueuePaused() {
  return getQueuePaused();
}

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', cls: 'pq-status-scheduled' },
  pending_approval: { label: 'Pending Approval', cls: 'pq-status-pending' },
  sent: { label: 'Sent', cls: 'pq-status-sent' },
  failed: { label: 'Failed', cls: 'pq-status-failed' },
};

const FILTERS = ['all', 'scheduled', 'pending_approval', 'failed'];
const FILTER_LABELS = { all: 'All', scheduled: 'Scheduled', pending_approval: 'Pending', failed: 'Failed' };

export default function PostQueue() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [paused, setPaused] = useState(getQueuePaused());
  const [editItem, setEditItem] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('10:00');

  useEffect(() => {
    setItems(getUnifiedQueue());
    const interval = setInterval(() => setItems(getUnifiedQueue()), 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = filter === 'all' ? items : items.filter(i => i.status === filter);

  const handlePauseToggle = () => {
    const next = !paused;
    setPaused(next);
    setQueuePaused(next);
  };

  const handleClearSent = () => {
    // Remove sent items from all sources
    const approval = JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]');
    localStorage.setItem('postforge_approval_queue', JSON.stringify(approval.filter(a => a.status !== 'sent')));

    const launch = JSON.parse(localStorage.getItem('postforge_launch_schedule') || '[]');
    localStorage.setItem('postforge_launch_schedule', JSON.stringify(launch.filter(l => l.status !== 'sent')));

    setItems(getUnifiedQueue());
  };

  const handleDelete = (item) => {
    if (item.source === 'approval') {
      const q = JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]');
      localStorage.setItem('postforge_approval_queue', JSON.stringify(q.filter(a => a.id !== item.id)));
    } else if (item.source === 'launch') {
      const q = JSON.parse(localStorage.getItem('postforge_launch_schedule') || '[]');
      localStorage.setItem('postforge_launch_schedule', JSON.stringify(q.filter(l => l.id !== item.id)));
    } else if (item.source === 'manual') {
      const q = JSON.parse(localStorage.getItem('postforge_manual_schedule') || '[]');
      localStorage.setItem('postforge_manual_schedule', JSON.stringify(q.filter(m => m.id !== item.id)));
    }
    setItems(getUnifiedQueue());
  };

  const handleRetry = (item) => {
    // Reset failed to scheduled
    if (item.source === 'approval') {
      const q = JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]');
      localStorage.setItem('postforge_approval_queue', JSON.stringify(q.map(a => a.id === item.id ? { ...a, status: 'approved' } : a)));
    } else if (item.source === 'launch') {
      const q = JSON.parse(localStorage.getItem('postforge_launch_schedule') || '[]');
      localStorage.setItem('postforge_launch_schedule', JSON.stringify(q.map(l => l.id === item.id ? { ...l, status: 'pending', error: '' } : l)));
    }
    setItems(getUnifiedQueue());
  };

  const handleEditOpen = (item) => {
    setEditItem(item);
    setEditContent(item.content || '');
  };

  const handleEditSave = () => {
    if (!editItem) return;
    if (editItem.source === 'approval') {
      const q = JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]');
      localStorage.setItem('postforge_approval_queue', JSON.stringify(q.map(a => a.id === editItem.id ? { ...a, content: editContent } : a)));
    } else if (editItem.source === 'launch') {
      const q = JSON.parse(localStorage.getItem('postforge_launch_schedule') || '[]');
      localStorage.setItem('postforge_launch_schedule', JSON.stringify(q.map(l => l.id === editItem.id ? { ...l, content: editContent } : l)));
    }
    setEditItem(null);
    setItems(getUnifiedQueue());
  };

  const handleRescheduleOpen = (item) => {
    const d = new Date(item.scheduledAt || Date.now());
    setRescheduleItem(item);
    setRescheduleDate(d.toISOString().split('T')[0]);
    setRescheduleTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  };

  const handleRescheduleSave = () => {
    if (!rescheduleItem) return;
    const newTime = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
    if (rescheduleItem.source === 'approval') {
      const q = JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]');
      localStorage.setItem('postforge_approval_queue', JSON.stringify(q.map(a => a.id === rescheduleItem.id ? { ...a, date: newTime } : a)));
    } else if (rescheduleItem.source === 'launch') {
      const q = JSON.parse(localStorage.getItem('postforge_launch_schedule') || '[]');
      localStorage.setItem('postforge_launch_schedule', JSON.stringify(q.map(l => l.id === rescheduleItem.id ? { ...l, scheduledAt: newTime } : l)));
    } else if (rescheduleItem.source === 'manual') {
      const q = JSON.parse(localStorage.getItem('postforge_manual_schedule') || '[]');
      localStorage.setItem('postforge_manual_schedule', JSON.stringify(q.map(m => m.id === rescheduleItem.id ? { ...m, scheduledAt: newTime } : m)));
    }
    setRescheduleItem(null);
    setItems(getUnifiedQueue());
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const counts = {
    all: items.length,
    scheduled: items.filter(i => i.status === 'scheduled').length,
    pending_approval: items.filter(i => i.status === 'pending_approval').length,
    failed: items.filter(i => i.status === 'failed').length,
  };

  return (
    <div>
      {/* Controls */}
      <div className="pq-controls">
        <div className="pq-controls-left">
          <button className={`btn btn-sm ${paused ? 'btn-primary' : 'btn-secondary'}`} onClick={handlePauseToggle}>
            {paused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause All</>}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleClearSent}>
            <Trash2 size={14} /> Clear Sent
          </button>
          {paused && <span style={{ fontSize: 12, color: '#eab308', fontWeight: 500 }}>Queue paused — no posts will send</span>}
        </div>
        <div className="pq-filters">
          {FILTERS.map(f => (
            <button key={f} className={`pq-filter-btn ${filter === f ? 'pq-filter-active' : ''}`} onClick={() => setFilter(f)}>
              {FILTER_LABELS[f]}
              {counts[f] > 0 && <span className="pq-filter-count">{counts[f]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Queue list */}
      {filteredItems.length > 0 ? (
        <div className="pq-list">
          {filteredItems.map(item => {
            const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.scheduled;
            return (
              <div key={item.id + item.source} className={`pq-item ${item.status === 'failed' ? 'pq-item-failed' : ''}`}>
                <div className="pq-item-top">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <span className={`platform-badge ${(item.platform || '').toLowerCase()}`}>{item.platform}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{item.community}</span>
                    <span className={`pq-status ${st.cls}`}>{st.label}</span>
                  </div>
                  <span className="pq-time">{formatDate(item.scheduledAt)}</span>
                </div>
                {item.content && (
                  <div className="pq-preview">{item.content.slice(0, 100)}{item.content.length > 100 ? '...' : ''}</div>
                )}
                {item.error && (
                  <div className="pq-error"><AlertCircle size={12} /> {item.error}</div>
                )}
                <div className="pq-actions">
                  {item.content && (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleEditOpen(item)}>
                      <Edit3 size={13} /> Edit
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => handleRescheduleOpen(item)}>
                    <Clock size={13} /> Reschedule
                  </button>
                  {item.status === 'failed' && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleRetry(item)}>
                      <RefreshCw size={13} /> Retry
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 32 }}>
          <Clock size={36} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>
            {filter === 'all' ? 'No posts in queue. Generate posts using any automation mode to see them here.' : `No ${FILTER_LABELS[filter].toLowerCase()} posts.`}
          </p>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="pq-modal-overlay" onClick={() => setEditItem(null)}>
          <div className="pq-modal" onClick={e => e.stopPropagation()}>
            <div className="pq-modal-header">
              <span style={{ fontWeight: 600 }}>Edit Post</span>
              <button className="pq-modal-close" onClick={() => setEditItem(null)}><X size={16} /></button>
            </div>
            <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`platform-badge ${(editItem.platform || '').toLowerCase()}`}>{editItem.platform}</span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{editItem.community}</span>
            </div>
            <textarea
              className="form-textarea"
              style={{ minHeight: 200 }}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleEditSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleItem && (
        <div className="pq-modal-overlay" onClick={() => setRescheduleItem(null)}>
          <div className="pq-modal" onClick={e => e.stopPropagation()}>
            <div className="pq-modal-header">
              <span style={{ fontWeight: 600 }}>Reschedule Post</span>
              <button className="pq-modal-close" onClick={() => setRescheduleItem(null)}><X size={16} /></button>
            </div>
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`platform-badge ${(rescheduleItem.platform || '').toLowerCase()}`}>{rescheduleItem.platform}</span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{rescheduleItem.community}</span>
            </div>
            <div className="form-grid" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input className="form-input" type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setRescheduleItem(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleRescheduleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
