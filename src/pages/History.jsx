import { useState } from 'react';
import { Clock, Copy, Trash2, Eye, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button className="btn btn-secondary btn-sm" onClick={handle}>
      <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function ViewModal({ entry, onClose }) {
  if (!entry) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card"
        style={{
          maxWidth: 760,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          marginBottom: 0,
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
        >
          <X size={20} />
        </button>

        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>
          {entry.communityName}
        </h2>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
          {entry.postType} · {formatDate(entry.date)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--muted)',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                Variant A
              </span>
              <CopyButton text={entry.variantA} />
            </div>
            <textarea
              className="form-textarea"
              readOnly
              value={entry.variantA || ''}
              style={{ minHeight: 160, width: '100%' }}
            />
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--muted)',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                Variant B
              </span>
              <CopyButton text={entry.variantB} />
            </div>
            <textarea
              className="form-textarea"
              readOnly
              value={entry.variantB || ''}
              style={{ minHeight: 160, width: '100%' }}
            />
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function History() {
  const { history, setHistory } = useApp();
  const [viewing, setViewing] = useState(null);

  const list = Array.isArray(history) ? history : [];
  const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleDelete = (id) => {
    setHistory(list.filter(h => h.id !== id));
  };

  return (
    <div>
      <h1 className="page-title">History</h1>

      {sorted.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: 'var(--muted)',
            fontSize: 14,
          }}
        >
          <Clock size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
          <div>No posts yet. Generate your first post.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map(entry => (
            <div key={entry.id} className="card" style={{ marginBottom: 0 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                      {entry.communityName}
                    </h3>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        color: 'var(--muted)',
                        fontWeight: 500,
                      }}
                    >
                      {entry.postType}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {formatDate(entry.date)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setViewing(entry)}
                  >
                    <Eye size={14} /> View
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDelete(entry.id)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                {truncate(entry.variantA, 150)}
              </div>
            </div>
          ))}
        </div>
      )}

      <ViewModal entry={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
