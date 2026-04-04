import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Edit3, X, Trash2, Check } from 'lucide-react';
import { getFailures, resolveFailure, removeFailure, incrementRetry, clearResolved, getCategoryInfo } from '../lib/failureLog';

export default function FailedPosts() {
  const [failures, setFailures] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [filter, setFilter] = useState('unresolved');

  useEffect(() => {
    setFailures(getFailures());
    const i = setInterval(() => setFailures(getFailures()), 5000);
    return () => clearInterval(i);
  }, []);

  const handleRetry = (f) => {
    incrementRetry(f.id);
    // In a real implementation this would re-trigger postToPlatform
    // For now just increment the counter and refresh
    setFailures(getFailures());
  };

  const handleDismiss = (id) => {
    resolveFailure(id);
    setFailures(getFailures());
  };

  const handleRemove = (id) => {
    removeFailure(id);
    setFailures(getFailures());
  };

  const handleClearResolved = () => {
    clearResolved();
    setFailures(getFailures());
  };

  const handleEditOpen = (f) => {
    setEditId(f.id);
    setEditContent(f.postPreview || '');
  };

  const handleEditRetry = (f) => {
    incrementRetry(f.id);
    setEditId(null);
    setFailures(getFailures());
  };

  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const filtered = filter === 'unresolved' ? failures.filter(f => !f.resolved) : filter === 'resolved' ? failures.filter(f => f.resolved) : failures;
  const unresolvedCount = failures.filter(f => !f.resolved).length;

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <div className="pq-filters">
          <button className={`pq-filter-btn ${filter === 'unresolved' ? 'pq-filter-active' : ''}`} onClick={() => setFilter('unresolved')}>
            Unresolved {unresolvedCount > 0 && <span className="pq-filter-count">{unresolvedCount}</span>}
          </button>
          <button className={`pq-filter-btn ${filter === 'resolved' ? 'pq-filter-active' : ''}`} onClick={() => setFilter('resolved')}>Resolved</button>
          <button className={`pq-filter-btn ${filter === 'all' ? 'pq-filter-active' : ''}`} onClick={() => setFilter('all')}>All</button>
        </div>
        {failures.some(f => f.resolved) && (
          <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={handleClearResolved}>
            <Trash2 size={12} /> Clear Resolved
          </button>
        )}
      </div>

      {/* Failure cards */}
      {filtered.length > 0 ? (
        <div className="fl-list">
          {filtered.map(f => {
            const cat = getCategoryInfo(f.category);
            const fix = cat.fix(f.platform, f.community);
            return (
              <div key={f.id} className={`fl-card ${f.resolved ? 'fl-card-resolved' : ''}`}>
                <div className="fl-card-header" style={{ borderColor: cat.color }}>
                  <AlertCircle size={14} style={{ color: cat.color }} />
                  <span className="fl-category" style={{ color: cat.color }}>{cat.label}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
                    <span className={`platform-badge ${f.platform.toLowerCase()}`}>{f.platform}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{f.community}</span>
                  </div>
                </div>

                <div className="fl-error-block"><code>{f.error}</code></div>

                <div className="fl-fix-hint">{fix}</div>

                {f.postPreview && (
                  <div className="fl-post-preview">{f.postPreview}</div>
                )}

                <div className="fl-card-meta">
                  <span className="fl-timestamp">{formatDate(f.date)}</span>
                  {f.retryCount > 0 && <span className="fl-retry-count">Retried {f.retryCount}x</span>}
                  {f.resolved && <span style={{ fontSize: 11, color: 'var(--success)' }}><Check size={10} /> Resolved</span>}
                </div>

                {/* Edit inline */}
                {editId === f.id && (
                  <div style={{ marginTop: 8 }}>
                    <textarea className="form-textarea" style={{ minHeight: 80, fontSize: 12 }} value={editContent} onChange={e => setEditContent(e.target.value)} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleEditRetry(f)}>Retry with edits</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                    </div>
                  </div>
                )}

                {!f.resolved && editId !== f.id && (
                  <div className="fl-card-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleRetry(f)}>
                      <RefreshCw size={12} /> Retry Now
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleEditOpen(f)}>
                      <Edit3 size={12} /> Edit & Retry
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleDismiss(f.id)}>
                      <X size={12} /> Dismiss
                    </button>
                  </div>
                )}

                {f.resolved && (
                  <div className="fl-card-actions">
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemove(f.id)}>
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 32 }}>
          {filter === 'unresolved' ? (
            <><AlertCircle size={36} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 8 }} /><p style={{ fontSize: 14, color: 'var(--muted)' }}>No failed posts. Everything is working!</p></>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>No {filter} failures.</p>
          )}
        </div>
      )}
    </div>
  );
}
