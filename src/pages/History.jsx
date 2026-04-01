import { useState, useEffect } from 'react';
import { Trash2, Copy, Clock } from 'lucide-react';

export default function History() {
  const [history, setHistory] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const data = localStorage.getItem('postforge_history');
    if (data) setHistory(JSON.parse(data));
  }, []);

  const handleDelete = (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('postforge_history', JSON.stringify(updated));
  };

  const handleClearAll = () => {
    setHistory([]);
    localStorage.removeItem('postforge_history');
  };

  const handleCopy = (content, id) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <h1 className="page-title">History</h1>
      <p className="page-subtitle">Your previously generated posts.</p>

      {history.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button className="btn btn-danger" onClick={handleClearAll}>
            <Trash2 size={14} />
            Clear All History
          </button>
        </div>
      )}

      {history.length > 0 ? (
        history.map(item => (
          <div key={item.id} className="history-item">
            <div className="history-meta">
              <div className="history-meta-left">
                {item.platform && (
                  <span className={`platform-badge ${item.platform.toLowerCase()}`}>
                    {item.platform}
                  </span>
                )}
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.community}</span>
                <span style={{ fontSize: 12, color: 'var(--border)' }}>|</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.postType} · {item.tone}</span>
              </div>
              <span className="history-date">{formatDate(item.date)}</span>
            </div>
            <div className="history-preview">{item.content}</div>
            <div className="output-actions" style={{ marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(item.content, item.id)}>
                <Copy size={14} />
                {copiedId === item.id ? 'Copied!' : 'Copy'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <Clock size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>No posts saved yet. Generate a post and save it to see it here.</p>
        </div>
      )}
    </div>
  );
}
