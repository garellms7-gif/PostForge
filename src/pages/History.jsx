import { useState, useEffect } from 'react';
import { Trash2, Copy, Clock, Star, Sparkles } from 'lucide-react';

function getTopPosts() {
  return JSON.parse(localStorage.getItem('postforge_top_posts') || '[]');
}

function saveTopPosts(posts) {
  localStorage.setItem('postforge_top_posts', JSON.stringify(posts));
}

export default function History({ navigateTo }) {
  const [history, setHistory] = useState([]);
  const [topPosts, setTopPosts] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    const data = localStorage.getItem('postforge_history');
    if (data) setHistory(JSON.parse(data));
    setTopPosts(getTopPosts());
  }, []);

  const handleDelete = (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('postforge_history', JSON.stringify(updated));
    // Also remove from top posts if present
    const updatedTop = topPosts.filter(t => t.id !== id);
    setTopPosts(updatedTop);
    saveTopPosts(updatedTop);
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

  const handleToggleStar = (item) => {
    const isStarred = topPosts.some(t => t.id === item.id);
    let updated;
    if (isStarred) {
      updated = topPosts.filter(t => t.id !== item.id);
    } else {
      updated = [item, ...topPosts];
    }
    setTopPosts(updated);
    saveTopPosts(updated);
  };

  const handleRemoveFromTop = (id) => {
    const updated = topPosts.filter(t => t.id !== id);
    setTopPosts(updated);
    saveTopPosts(updated);
  };

  const handleUseAsInspiration = (item) => {
    // Navigate to Generator with the community pre-selected
    if (navigateTo) {
      navigateTo('generator', { communityName: item.community });
    }
  };

  const isStarred = (id) => topPosts.some(t => t.id === id);

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

  const displayItems = tab === 'top' ? topPosts : history;
  const emptyMessage = tab === 'top'
    ? 'No top posts yet. Mark posts as high performers to see them here.'
    : 'No posts saved yet. Generate a post and save it to see it here.';

  return (
    <div>
      <h1 className="page-title">History</h1>
      <p className="page-subtitle">Your previously generated posts.</p>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'all' ? 'tab-active' : ''}`} onClick={() => setTab('all')}>
          All Posts
          {history.length > 0 && <span className="tab-count">{history.length}</span>}
        </button>
        <button className={`tab-btn ${tab === 'top' ? 'tab-active' : ''}`} onClick={() => setTab('top')}>
          <Star size={14} />
          Top Posts
          {topPosts.length > 0 && <span className="tab-count">{topPosts.length}</span>}
        </button>
      </div>

      {tab === 'all' && history.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button className="btn btn-danger" onClick={handleClearAll}>
            <Trash2 size={14} />
            Clear All History
          </button>
        </div>
      )}

      {displayItems.length > 0 ? (
        displayItems.map(item => (
          <div key={item.id} className={`history-item ${isStarred(item.id) ? 'history-item-starred' : ''}`}>
            <div className="history-meta">
              <div className="history-meta-left">
                {isStarred(item.id) && (
                  <Star size={14} fill="var(--accent)" color="var(--accent)" />
                )}
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
              {tab === 'all' && (
                <button
                  className={`btn btn-sm ${isStarred(item.id) ? 'btn-star-active' : 'btn-secondary'}`}
                  onClick={() => handleToggleStar(item)}
                >
                  <Star size={14} />
                  {isStarred(item.id) ? 'High Performer' : 'Mark as High Performer'}
                </button>
              )}
              {tab === 'top' && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => handleUseAsInspiration(item)}>
                    <Sparkles size={14} />
                    Use as Inspiration
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveFromTop(item.id)}>
                    <Star size={14} />
                    Remove
                  </button>
                </>
              )}
              {tab === 'all' && (
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <Clock size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
