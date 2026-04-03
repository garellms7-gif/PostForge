import { useState, useEffect } from 'react';
import { Trash2, Copy, Clock, Star, Sparkles, Recycle, RefreshCw, BarChart2, AlertCircle, Save } from 'lucide-react';
import { UndoToast } from '../components/UxHelpers';
import RepurposeEngine from '../components/RepurposeEngine';
import { calculateRawScore, calculateEngagementScore, getScoreColor, getScoreLabel } from '../lib/scoring';
import { maybeExtractStyleDNA } from '../lib/styleDNA';

function getTopPosts() { return JSON.parse(localStorage.getItem('postforge_top_posts') || '[]'); }
function saveTopPosts(posts) { localStorage.setItem('postforge_top_posts', JSON.stringify(posts)); }
function getEngagement() { return JSON.parse(localStorage.getItem('postforge_engagement') || '{}'); }
function saveEngagement(data) { localStorage.setItem('postforge_engagement', JSON.stringify(data)); }
function getPostLog() { return JSON.parse(localStorage.getItem('postforge_post_log') || '[]'); }

const PLATFORM_METRICS = {
  Discord: [{ key: 'reactions', label: 'Reactions' }, { key: 'replies', label: 'Replies' }],
  LinkedIn: [{ key: 'likes', label: 'Likes' }, { key: 'comments', label: 'Comments' }, { key: 'shares', label: 'Shares' }, { key: 'impressions', label: 'Impressions' }],
  Reddit: [{ key: 'upvotes', label: 'Upvotes' }, { key: 'comments', label: 'Comments' }, { key: 'ratio', label: 'Upvote Ratio %' }],
  X: [{ key: 'likes', label: 'Likes' }, { key: 'retweets', label: 'Retweets' }, { key: 'replies', label: 'Replies' }, { key: 'impressions', label: 'Impressions' }],
};

const SENTIMENTS = ['Positive', 'Neutral', 'Negative', 'Mixed'];

function getTotalInteractions(eng) {
  if (!eng) return 0;
  return Object.entries(eng).filter(([k]) => k !== 'sentiment' && k !== 'notes' && k !== 'ratio').reduce((s, [, v]) => s + (Number(v) || 0), 0);
}

function getPerformanceLabel(postId, community, engagement) {
  const all = getEngagement();
  const communityEngagements = Object.entries(all).filter(([, e]) => e._community === community).map(([, e]) => getTotalInteractions(e));
  if (communityEngagements.length < 2) return null;

  const sorted = [...communityEngagements].sort((a, b) => b - a);
  const total = getTotalInteractions(engagement);
  const avg = communityEngagements.reduce((s, v) => s + v, 0) / communityEngagements.length;
  const top10Threshold = sorted[Math.max(0, Math.floor(sorted.length * 0.1))] || 0;

  if (total >= top10Threshold && total > 0) return { label: 'Top Post', cls: 'eng-perf-top' };
  if (total > avg) return { label: 'Good', cls: 'eng-perf-good' };
  if (total >= avg * 0.5) return { label: 'Average', cls: 'eng-perf-avg' };
  return { label: 'Low', cls: 'eng-perf-low' };
}

function shouldShowReminder() {
  const settings = JSON.parse(localStorage.getItem('postforge_settings') || '{}');
  if (!settings.engagementReminder) return false;
  const hours = settings.engagementReminderHours || 24;
  const dismissed = localStorage.getItem('postforge_eng_reminder_dismissed');
  if (dismissed === new Date().toISOString().split('T')[0]) return false;

  const log = getPostLog();
  const cutoff = Date.now() - hours * 3600000;
  const recent = log.filter(l => l.status === 'success' && new Date(l.date).getTime() > cutoff && new Date(l.date).getTime() < Date.now() - 3600000);
  const engagement = getEngagement();
  const untracked = recent.filter(l => !engagement[l.id]);
  return untracked.length > 0 ? untracked.length : false;
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
    // Auto-extract Style DNA for high-scoring posts
    const score = calculateEngagementScore(platform, { ...form, _platform: platform }, post.community);
    if (score >= 70 && post.content) {
      maybeExtractStyleDNA(post.id, post.content, post.community, score).catch(() => {});
    }
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
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize="11" fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  );
}

function EngagementBadge({ postId, community, platform }) {
  const all = getEngagement();
  const eng = all[postId];
  if (!eng) return null;

  const raw = calculateRawScore(platform || eng._platform, eng);
  const normalized = calculateEngagementScore(platform || eng._platform, eng, community);
  const label = getScoreLabel(normalized);
  const color = getScoreColor(normalized);

  return (
    <div className="eng-badge-row">
      <ScoreGauge score={normalized} />
      <div className="eng-badge-info">
        <span className="eng-score-label" style={{ color }}>{label}</span>
        <span className="eng-raw-score">{raw} raw pts</span>
      </div>
      {eng.sentiment && <span className={`eng-sentiment eng-sent-${eng.sentiment.toLowerCase()}`}>{eng.sentiment}</span>}
    </div>
  );
}

export default function History({ navigateTo }) {
  const [history, setHistory] = useState([]);
  const [topPosts, setTopPosts] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [tab, setTab] = useState('all');
  const [undoItem, setUndoItem] = useState(null);
  const [repurposePost, setRepurposePost] = useState(null);
  const [engagementFormId, setEngagementFormId] = useState(null);
  const [engagementVersion, setEngagementVersion] = useState(0);
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    const data = localStorage.getItem('postforge_history');
    if (data) setHistory(JSON.parse(data));
    setTopPosts(getTopPosts());
    const rc = shouldShowReminder();
    setReminderCount(rc || 0);
  }, []);

  const handleDelete = (id) => {
    const item = history.find(h => h.id === id);
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('postforge_history', JSON.stringify(updated));
    const updatedTop = topPosts.filter(t => t.id !== id);
    setTopPosts(updatedTop); saveTopPosts(updatedTop);
    setUndoItem(item);
  };

  const handleUndoDelete = () => {
    if (!undoItem) return;
    const updated = [undoItem, ...history];
    setHistory(updated);
    localStorage.setItem('postforge_history', JSON.stringify(updated));
    setUndoItem(null);
  };

  const handleClearAll = () => { setHistory([]); localStorage.removeItem('postforge_history'); };
  const handleCopy = (content, id) => { navigator.clipboard.writeText(content); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
  const handleToggleStar = (item) => {
    const starred = topPosts.some(t => t.id === item.id);
    const updated = starred ? topPosts.filter(t => t.id !== item.id) : [item, ...topPosts];
    setTopPosts(updated); saveTopPosts(updated);
    // Extract Style DNA when marking as high performer
    if (!starred && item.content && item.community) {
      maybeExtractStyleDNA(item.id, item.content, item.community, 100).catch(() => {});
    }
  };
  const handleRemoveFromTop = (id) => { const updated = topPosts.filter(t => t.id !== id); setTopPosts(updated); saveTopPosts(updated); };
  const handleUseAsInspiration = (item) => { if (navigateTo) navigateTo('generator', { communityName: item.community }); };
  const isStarred = (id) => topPosts.some(t => t.id === id);
  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const displayItems = tab === 'top' ? topPosts : history;

  const dismissReminder = () => {
    localStorage.setItem('postforge_eng_reminder_dismissed', new Date().toISOString().split('T')[0]);
    setReminderCount(0);
  };

  return (
    <div>
      <h1 className="page-title">History</h1>
      <p className="page-subtitle">Your previously generated posts.</p>

      {/* Engagement reminder banner */}
      {reminderCount > 0 && (
        <div className="eng-reminder">
          <AlertCircle size={15} />
          <span>You have <strong>{reminderCount} posts</strong> sent recently — log their engagement to improve future posts.</span>
          <button className="btn btn-secondary btn-sm" onClick={dismissReminder}>Dismiss</button>
        </div>
      )}

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'all' ? 'tab-active' : ''}`} onClick={() => setTab('all')}>
          All Posts {history.length > 0 && <span className="tab-count">{history.length}</span>}
        </button>
        <button className={`tab-btn ${tab === 'top' ? 'tab-active' : ''}`} onClick={() => setTab('top')}>
          <Star size={14} /> Top Posts {topPosts.length > 0 && <span className="tab-count">{topPosts.length}</span>}
        </button>
      </div>

      {tab === 'all' && history.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button className="btn btn-danger" onClick={handleClearAll}><Trash2 size={14} /> Clear All History</button>
        </div>
      )}

      {displayItems.length > 0 ? (
        displayItems.map(item => (
          <div key={item.id} className={`history-item ${isStarred(item.id) ? 'history-item-starred' : ''}`}>
            <div className="history-meta">
              <div className="history-meta-left">
                {isStarred(item.id) && <Star size={14} fill="var(--accent)" color="var(--accent)" />}
                {item.platform && <span className={`platform-badge ${item.platform.toLowerCase()}`}>{item.platform}</span>}
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.community}</span>
                <span style={{ fontSize: 12, color: 'var(--border)' }}>|</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.postType} · {item.tone}</span>
                {item.recycledAt && <span className="recycled-label"><Recycle size={11} /> Recycled from {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                {item.repurposedFrom && <span className="rp-badge"><RefreshCw size={10} /> Repurposed from {new Date(item.repurposedFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
              </div>
              <span className="history-date">{formatDate(item.recycledAt || item.date)}</span>
            </div>

            {/* Engagement badge */}
            <EngagementBadge key={engagementVersion} postId={item.id} community={item.community} platform={item.platform} />

            <div className="history-preview">{item.content}</div>

            {/* Engagement form */}
            {engagementFormId === item.id && (
              <EngagementForm post={item} onSave={() => { setEngagementFormId(null); setEngagementVersion(v => v + 1); }} onCancel={() => setEngagementFormId(null)} />
            )}

            <div className="output-actions" style={{ marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(item.content, item.id)}>
                <Copy size={14} /> {copiedId === item.id ? 'Copied!' : 'Copy'}
              </button>
              {tab === 'all' && (
                <button className="btn btn-secondary btn-sm" onClick={() => setEngagementFormId(engagementFormId === item.id ? null : item.id)}>
                  <BarChart2 size={13} /> {engagementFormId === item.id ? 'Close' : 'Add Engagement'}
                </button>
              )}
              {tab === 'all' && (
                <button className={`btn btn-sm ${isStarred(item.id) ? 'btn-star-active' : 'btn-secondary'}`} onClick={() => handleToggleStar(item)}>
                  <Star size={14} /> {isStarred(item.id) ? 'High Performer' : 'Mark as High Performer'}
                </button>
              )}
              {tab === 'top' && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => handleUseAsInspiration(item)}><Sparkles size={14} /> Use as Inspiration</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveFromTop(item.id)}><Star size={14} /> Remove</button>
                </>
              )}
              {tab === 'all' && (
                <button className="btn btn-secondary btn-sm" onClick={() => setRepurposePost(item)}>
                  <RefreshCw size={13} /> Repurpose
                </button>
              )}
              {tab === 'all' && (
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></button>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <Clock size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12 }} />
          {tab === 'top' ? (
            <><p>No top posts yet.</p><p style={{ marginTop: 8, fontSize: 13 }}>Mark posts as high performers in the All Posts tab to see them here.</p><button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => setTab('all')}>Go to All Posts</button></>
          ) : (
            <><p>No posts saved yet.</p><p style={{ marginTop: 8, fontSize: 13 }}>Generate a post and click "Save to History" to start building your library.</p>{navigateTo && <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigateTo('generator')}>Go to Generator</button>}</>
          )}
        </div>
      )}

      {repurposePost && <RepurposeEngine post={repurposePost} onClose={() => { setRepurposePost(null); setHistory(JSON.parse(localStorage.getItem('postforge_history') || '[]')); }} />}
      {undoItem && <UndoToast key={undoItem.id} message="Post deleted" onUndo={handleUndoDelete} />}
    </div>
  );
}
