import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Trash2, Copy, Clock, Star, Sparkles, Recycle, RefreshCw, BarChart2, AlertCircle, Save, Download, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { showUndoToast, showTypeConfirm } from '../components/UndoManager';
import RepurposeEngine from '../components/RepurposeEngine';
import { calculateRawScore, calculateEngagementScore, getScoreColor, getScoreLabel } from '../lib/scoring';
import { maybeExtractStyleDNA } from '../lib/styleDNA';
import { safeGet, safeSet } from '../lib/safeStorage';

function getTopPosts() { return safeGet('postforge_top_posts', []); }
function saveTopPosts(posts) { safeSet('postforge_top_posts', posts); }
function getEngagement() { return safeGet('postforge_engagement', {}); }
function saveEngagement(data) { safeSet('postforge_engagement', data); }
function getPostLog() { return safeGet('postforge_post_log', []); }
function getListMode() { return safeGet('postforge_settings', {}).historyMode || 'pagination'; }

const PLATFORM_METRICS = {
  Discord: [{ key: 'reactions', label: 'Reactions' }, { key: 'replies', label: 'Replies' }],
  LinkedIn: [{ key: 'likes', label: 'Likes' }, { key: 'comments', label: 'Comments' }, { key: 'shares', label: 'Shares' }, { key: 'impressions', label: 'Impressions' }],
  Reddit: [{ key: 'upvotes', label: 'Upvotes' }, { key: 'comments', label: 'Comments' }, { key: 'ratio', label: 'Upvote Ratio %' }],
  X: [{ key: 'likes', label: 'Likes' }, { key: 'retweets', label: 'Retweets' }, { key: 'replies', label: 'Replies' }, { key: 'impressions', label: 'Impressions' }],
};
const SENTIMENTS = ['Positive', 'Neutral', 'Negative', 'Mixed'];
const PAGE_SIZE = 20;

function shouldShowReminder() {
  const settings = safeGet('postforge_settings', {});
  if (!settings.engagementReminder) return false;
  const hours = settings.engagementReminderHours || 24;
  if (localStorage.getItem('postforge_eng_reminder_dismissed') === new Date().toISOString().split('T')[0]) return false;
  const log = getPostLog();
  const cutoff = Date.now() - hours * 3600000;
  const recent = log.filter(l => l.status === 'success' && new Date(l.date).getTime() > cutoff && new Date(l.date).getTime() < Date.now() - 3600000);
  return recent.filter(l => !getEngagement()[l.id]).length || 0;
}

function EngagementForm({ post, onSave, onCancel }) {
  const platform = post.platform || '';
  const metrics = PLATFORM_METRICS[platform] || PLATFORM_METRICS.Discord;
  const existing = getEngagement()[post.id] || {};
  const [form, setForm] = useState({ ...existing });
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = () => {
    const data = getEngagement();
    data[post.id] = { ...form, _community: post.community, _platform: platform };
    saveEngagement(data);
    const score = calculateEngagementScore(platform, { ...form, _platform: platform }, post.community);
    if (score >= 70 && post.content) maybeExtractStyleDNA(post.id, post.content, post.community, score).catch(() => {});
    onSave();
  };
  return (
    <div className="eng-form">
      <div className="eng-form-metrics">
        {metrics.map(m => (
          <div key={m.key} className="eng-form-field">
            <label className="form-label">{m.label}</label>
            <input className="form-input" type="number" min="0" value={form[m.key] || ''} onChange={e => update(m.key, e.target.value)} placeholder="0" style={{ padding: '5px 8px', fontSize: 12 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Sentiment</label>
          <select className="form-select" value={form.sentiment || ''} onChange={e => update('sentiment', e.target.value)} style={{ padding: '5px 8px', fontSize: 12 }}>
            <option value="">Select...</option>
            {SENTIMENTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 2 }}>
          <label className="form-label">Notes</label>
          <input className="form-input" value={form.notes || ''} onChange={e => update('notes', e.target.value)} placeholder="e.g. lots of DMs after this" style={{ padding: '5px 8px', fontSize: 12 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave}><Save size={12} /> Save</button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ScoreGauge({ score, size = 40 }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(score, 100) / 100) * circ;
  const color = getScoreColor(score);
  return (
    <svg width={size} height={size} className="eng-gauge">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.5s' }} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize="11" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

function EngagementBadge({ postId, community, platform }) {
  const all = getEngagement();
  const eng = all[postId];
  if (!eng) return null;
  const raw = calculateRawScore(platform || eng._platform, eng);
  const normalized = calculateEngagementScore(platform || eng._platform, eng, community);
  return (
    <div className="eng-badge-row">
      <ScoreGauge score={normalized} />
      <div className="eng-badge-info">
        <span className="eng-score-label" style={{ color: getScoreColor(normalized) }}>{getScoreLabel(normalized)}</span>
        <span className="eng-raw-score">{raw} raw pts</span>
      </div>
      {eng.sentiment && <span className={`eng-sentiment eng-sent-${eng.sentiment.toLowerCase()}`}>{eng.sentiment}</span>}
    </div>
  );
}

export default function History({ navigateTo, simpleMode }) {
  const [history, setHistory] = useState([]);
  const [topPosts, setTopPosts] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [tab, setTab] = useState('all');
  const [repurposePost, setRepurposePost] = useState(null);
  const [engagementFormId, setEngagementFormId] = useState(null);
  const [engagementVersion, setEngagementVersion] = useState(0);
  const [reminderCount, setReminderCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedCount, setLoadedCount] = useState(PAGE_SIZE);
  const [jumpPage, setJumpPage] = useState('');
  const listMode = getListMode();
  const scrollRef = useRef(null);

  useEffect(() => {
    const data = localStorage.getItem('postforge_history');
    if (data) setHistory(JSON.parse(data));
    setTopPosts(getTopPosts());
    setReminderCount(shouldShowReminder() || 0);
  }, []);

  // Debounce search by 300ms
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1); setLoadedCount(PAGE_SIZE); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Infinite scroll observer
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (listMode !== 'infinite' || tab !== 'all') return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setLoadedCount(c => c + PAGE_SIZE);
    }, { threshold: 0.1 });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [listMode, tab, debouncedSearch]);

  // Filter items
  const filteredItems = useMemo(() => {
    let items = tab === 'top' ? topPosts : history;
    if (debouncedSearch && tab === 'all') {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(i => (i.content || '').toLowerCase().includes(q) || (i.community || '').toLowerCase().includes(q) || (i.postType || '').toLowerCase().includes(q));
    }
    return items;
  }, [history, topPosts, tab, debouncedSearch]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginatedItems = listMode === 'infinite'
    ? filteredItems.slice(0, loadedCount)
    : filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allLoaded = loadedCount >= filteredItems.length;

  // Stats
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisWeek = history.filter(h => new Date(h.date) >= weekStart).length;
  const thisMonth = history.filter(h => new Date(h.date) >= monthStart).length;
  const storageKB = ((localStorage.getItem('postforge_history') || '').length / 1024).toFixed(1);

  const handleDelete = (id) => {
    const item = history.find(h => h.id === id);
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('postforge_history', JSON.stringify(updated));
    const updatedTop = topPosts.filter(t => t.id !== id);
    setTopPosts(updatedTop); saveTopPosts(updatedTop);
    showUndoToast('Post deleted', () => {
      const restored = [item, ...updated];
      setHistory(restored);
      localStorage.setItem('postforge_history', JSON.stringify(restored));
    });
  };

  const handleClearAll = async () => {
    const confirmed = await showTypeConfirm('This will permanently delete all post history. This cannot be undone.');
    if (confirmed) { setHistory([]); localStorage.removeItem('postforge_history'); }
  };

  const handleClearOld = () => {
    const cutoff = Date.now() - 90 * 86400000;
    const old = history.filter(h => new Date(h.date).getTime() < cutoff);
    const kept = history.filter(h => new Date(h.date).getTime() >= cutoff);
    setHistory(kept);
    localStorage.setItem('postforge_history', JSON.stringify(kept));
    showUndoToast(`${old.length} old posts removed`, () => {
      setHistory(history);
      localStorage.setItem('postforge_history', JSON.stringify(history));
    });
  };

  const handleExportHistory = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postforge-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (content, id) => { navigator.clipboard.writeText(content); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
  const handleToggleStar = (item) => {
    const starred = topPosts.some(t => t.id === item.id);
    const updated = starred ? topPosts.filter(t => t.id !== item.id) : [item, ...topPosts];
    setTopPosts(updated); saveTopPosts(updated);
    if (!starred && item.content && item.community) maybeExtractStyleDNA(item.id, item.content, item.community, 100).catch(() => {});
  };
  const handleRemoveFromTop = (id) => { const updated = topPosts.filter(t => t.id !== id); setTopPosts(updated); saveTopPosts(updated); };
  const handleUseAsInspiration = (item) => { if (navigateTo) navigateTo('generator', { communityName: item.community }); };
  const isStarred = (id) => topPosts.some(t => t.id === id);
  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const dismissReminder = () => { localStorage.setItem('postforge_eng_reminder_dismissed', new Date().toISOString().split('T')[0]); setReminderCount(0); };

  const handleJumpPage = (e) => {
    e.preventDefault();
    const p = parseInt(jumpPage);
    if (p >= 1 && p <= totalPages) { setCurrentPage(p); setJumpPage(''); }
  };

  const startIdx = listMode === 'infinite' ? 1 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIdx = listMode === 'infinite' ? Math.min(loadedCount, filteredItems.length) : Math.min(currentPage * PAGE_SIZE, filteredItems.length);

  return (
    <div>
      <h1 className="page-title">History</h1>
      <p className="page-subtitle">Your previously generated posts.</p>

      {reminderCount > 0 && (
        <div className="eng-reminder">
          <AlertCircle size={15} />
          <span>You have <strong>{reminderCount} posts</strong> sent recently — log their engagement to improve future posts.</span>
          <button className="btn btn-secondary btn-sm" onClick={dismissReminder}>Dismiss</button>
        </div>
      )}

      {/* Stats bar */}
      <div className="hs-stats-bar">
        <span className="hs-stat">{history.length} total</span>
        <span className="hs-stat">{thisMonth} this month</span>
        <span className="hs-stat">{thisWeek} this week</span>
        <span className="hs-stat hs-stat-muted">{storageKB} KB</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportHistory}><Download size={12} /> Export</button>
          {history.some(h => new Date(h.date).getTime() < Date.now() - 90 * 86400000) && (
            <button className="btn btn-secondary btn-sm" onClick={handleClearOld}><Trash2 size={12} /> Clear 90d+</button>
          )}
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'all' ? 'tab-active' : ''}`} onClick={() => { setTab('all'); setCurrentPage(1); setLoadedCount(PAGE_SIZE); }}>
          All Posts {history.length > 0 && <span className="tab-count">{history.length}</span>}
        </button>
        <button className={`tab-btn ${tab === 'top' ? 'tab-active' : ''}`} onClick={() => setTab('top')}>
          <Star size={14} /> Top Posts {topPosts.length > 0 && <span className="tab-count">{topPosts.length}</span>}
        </button>
      </div>

      {/* Search bar */}
      {tab === 'all' && (
        <div className="hs-search">
          <Search size={14} />
          <input className="hs-search-input" placeholder="Search posts by content, community, or type..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchQuery && <button className="hs-search-clear" onClick={() => setSearchQuery('')}><X size={12} /></button>}
        </div>
      )}

      {tab === 'all' && history.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-danger btn-sm" onClick={handleClearAll}><Trash2 size={14} /> Clear All</button>
          {filteredItems.length > 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Showing {startIdx}–{endIdx} of {filteredItems.length} posts</span>}
        </div>
      )}

      {/* Post list */}
      {paginatedItems.length > 0 ? (
        <div ref={scrollRef}>
          {paginatedItems.map(item => (
            <div key={item.id} className={`history-item ${isStarred(item.id) ? 'history-item-starred' : ''}`}>
              <div className="history-meta">
                <div className="history-meta-left">
                  {isStarred(item.id) && <Star size={14} fill="var(--accent)" color="var(--accent)" />}
                  {item.platform && <span className={`platform-badge ${item.platform.toLowerCase()}`}>{item.platform}</span>}
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.community}</span>
                  <span style={{ fontSize: 12, color: 'var(--border)' }}>|</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.postType} · {item.tone}</span>
                  {item.recycledAt && <span className="recycled-label"><Recycle size={11} /> Recycled</span>}
                  {item.repurposedFrom && <span className="rp-badge"><RefreshCw size={10} /> Repurposed</span>}
                </div>
                <span className="history-date">{formatDate(item.recycledAt || item.date)}</span>
              </div>
              {!simpleMode && <EngagementBadge key={engagementVersion} postId={item.id} community={item.community} platform={item.platform} />}
              <div className="history-preview">{item.content}</div>
              {engagementFormId === item.id && (
                <EngagementForm post={item} onSave={() => { setEngagementFormId(null); setEngagementVersion(v => v + 1); }} onCancel={() => setEngagementFormId(null)} />
              )}
              <div className="output-actions" style={{ marginTop: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(item.content, item.id)}>
                  <Copy size={14} /> {copiedId === item.id ? 'Copied!' : 'Copy'}
                </button>
                {tab === 'all' && !simpleMode && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setEngagementFormId(engagementFormId === item.id ? null : item.id)}>
                    <BarChart2 size={13} /> {engagementFormId === item.id ? 'Close' : 'Engagement'}
                  </button>
                )}
                {tab === 'all' && (
                  <button className={`btn btn-sm ${isStarred(item.id) ? 'btn-star-active' : 'btn-secondary'}`} onClick={() => handleToggleStar(item)}>
                    <Star size={14} />
                  </button>
                )}
                {tab === 'top' && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => handleUseAsInspiration(item)}><Sparkles size={14} /> Inspire</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemoveFromTop(item.id)}><Star size={14} /></button>
                  </>
                )}
                {tab === 'all' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setRepurposePost(item)}><RefreshCw size={13} /></button>
                )}
                {tab === 'all' && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}

          {/* Infinite scroll sentinel */}
          {listMode === 'infinite' && tab === 'all' && !allLoaded && (
            <div ref={sentinelRef} className="hs-loading">
              <span className="spinner" /> Loading more posts...
            </div>
          )}
          {listMode === 'infinite' && tab === 'all' && allLoaded && filteredItems.length > PAGE_SIZE && (
            <div className="hs-all-loaded">All {filteredItems.length} posts loaded</div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <Clock size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12 }} />
          {debouncedSearch ? (
            <><p>No posts match "{debouncedSearch}"</p><button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setSearchQuery('')}>Clear search</button></>
          ) : tab === 'top' ? (
            <><p>No top posts yet.</p><button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => setTab('all')}>Go to All Posts</button></>
          ) : (
            <><p>No posts saved yet.</p>{navigateTo && <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigateTo('generator')}>Go to Generator</button>}</>
          )}
        </div>
      )}

      {/* Pagination controls */}
      {listMode === 'pagination' && filteredItems.length > PAGE_SIZE && tab === 'all' && (
        <div className="hs-pagination">
          <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <ChevronLeft size={14} /> Previous
          </button>
          <div className="hs-page-nums">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (
                <button key={pageNum} className={`hs-page-btn ${currentPage === pageNum ? 'hs-page-active' : ''}`} onClick={() => setCurrentPage(pageNum)}>
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            Next <ChevronRight size={14} />
          </button>
          <form onSubmit={handleJumpPage} className="hs-jump">
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Go to</span>
            <input className="form-input" style={{ width: 40, padding: '3px 6px', fontSize: 11, textAlign: 'center' }} value={jumpPage} onChange={e => setJumpPage(e.target.value)} />
          </form>
        </div>
      )}

      {repurposePost && <RepurposeEngine post={repurposePost} onClose={() => { setRepurposePost(null); setHistory(JSON.parse(localStorage.getItem('postforge_history') || '[]')); }} />}
    </div>
  );
}
