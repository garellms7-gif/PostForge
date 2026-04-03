import { useState, useEffect } from 'react';
import { Flame, Calendar, Send, Users, Clock, Check, X, Package, Timer } from 'lucide-react';
import { getScheduledPosts } from '../lib/scheduler';

function getHistory() { return JSON.parse(localStorage.getItem('postforge_history') || '[]'); }
function getPostLog() { return JSON.parse(localStorage.getItem('postforge_post_log') || '[]'); }
function getCommunities() { return JSON.parse(localStorage.getItem('postforge_communities') || '[]'); }
function getProducts() { return JSON.parse(localStorage.getItem('postforge_products') || '[]'); }
function getDailyGoal() {
  const s = JSON.parse(localStorage.getItem('postforge_settings') || '{}');
  return s.dailyGoal || 1;
}
function saveDailyGoal(g) {
  const s = JSON.parse(localStorage.getItem('postforge_settings') || '{}');
  s.dailyGoal = g;
  localStorage.setItem('postforge_settings', JSON.stringify(s));
}

function toDateKey(iso) { return new Date(iso).toISOString().split('T')[0]; }
function isToday(iso) { return toDateKey(iso) === toDateKey(new Date().toISOString()); }

function calcStreak(allDates) {
  if (allDates.length === 0) return 0;
  const unique = [...new Set(allDates.map(toDateKey))].sort().reverse();
  const today = toDateKey(new Date().toISOString());
  const yesterday = toDateKey(new Date(Date.now() - 86400000).toISOString());
  if (unique[0] !== today && unique[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const diff = (new Date(unique[i - 1]) - new Date(unique[i])) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function getCredStatus(c) {
  const cr = c.credentials || {};
  if (c.platform === 'Discord') return cr.webhookUrl ? 'connected' : 'missing';
  if (c.platform === 'LinkedIn') return cr.accessToken ? 'connected' : 'missing';
  if (c.platform === 'Reddit') return cr.appId && cr.username ? 'connected' : 'missing';
  if (c.platform === 'X') return cr.apiKey && cr.accessToken ? 'connected' : 'missing';
  return 'missing';
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Dashboard({ navigateTo }) {
  const [postLog, setPostLog] = useState([]);
  const [history, setHistory] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [products, setProducts] = useState([]);
  const [dailyGoal, setDailyGoalState] = useState(1);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setPostLog(getPostLog());
    setHistory(getHistory());
    setCommunities(getCommunities());
    setProducts(getProducts());
    setDailyGoalState(getDailyGoal());
    const i = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(i);
  }, []);

  const allEntries = [...postLog, ...history];
  const allDates = allEntries.map(e => e.date).filter(Boolean);

  // Section 1 — Today's Overview
  const todayKey = toDateKey(new Date().toISOString());
  const scheduledToday = getScheduledPosts().filter(p => toDateKey(p.time.toISOString()) === todayKey).length;
  const sentToday = postLog.filter(e => isToday(e.date) && e.status === 'success').length;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); weekStart.setHours(0, 0, 0, 0);
  const activeCommThisWeek = new Set([...postLog.filter(e => new Date(e.date) >= weekStart).map(e => e.community), ...history.filter(e => new Date(e.date) >= weekStart).map(e => e.community)].filter(Boolean)).size;
  const streak = calcStreak(allDates);

  // Section 2 — Weekly Performance
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = toDateKey(d.toISOString());
    const count = postLog.filter(e => toDateKey(e.date) === key && e.status === 'success').length;
    last7.push({ day: d, key, count, dayName: DAY_NAMES[d.getDay()], dayNum: d.getDate() });
  }
  const maxWeek = Math.max(1, ...last7.map(d => d.count), dailyGoal);

  // Section 3 — Platform Breakdown
  const platformTypes = ['Discord', 'LinkedIn', 'Reddit', 'X'];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const platformCards = platformTypes.map(p => {
    const comms = communities.filter(c => c.platform === p);
    const sentThisMonth = postLog.filter(e => e.platform === p && new Date(e.date) >= monthStart && e.status === 'success').length;
    const connected = comms.filter(c => getCredStatus(c) === 'connected').length;
    const scheduled = getScheduledPosts().filter(sp => sp.platform === p && sp.time > new Date()).sort((a, b) => a.time - b.time);
    const nextPost = scheduled[0];
    return { platform: p, count: comms.length, sentThisMonth, connected, nextPost };
  }).filter(p => p.count > 0);

  // Section 4 — Product Leaderboard
  const productLeaderboard = products.map(p => {
    const count = postLog.filter(e => e.productName === p.name && new Date(e.date) >= monthStart).length;
    const commReached = new Set(postLog.filter(e => e.productName === p.name).map(e => e.community).filter(Boolean)).size;
    return { name: p.name || 'Untitled', count, commReached };
  }).sort((a, b) => b.count - a.count);
  const maxProductPosts = Math.max(1, productLeaderboard[0]?.count || 1);

  // Section 5 — Activity Feed
  const activityFeed = postLog.slice(0, 20);

  // Section 6 — Upcoming Posts
  const upcoming = getScheduledPosts().filter(p => p.time > new Date()).sort((a, b) => a.time - b.time).slice(0, 5);

  const formatTime = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const formatDateTime = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatCountdown = (target) => {
    const diff = target.getTime() - now;
    if (diff <= 0) return 'Now';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Your PostForge momentum at a glance.</p>

      {/* Section 1 — Today's Overview */}
      <div className="dash-stats-grid dash-stats-4">
        <div className="dash-stat-card">
          <div className="dash-stat-header"><span className="dash-stat-label">Scheduled Today</span><Calendar size={16} className="dash-icon-muted" /></div>
          <div className="dash-stat-value">{scheduledToday}</div>
          <div className="dash-stat-sub">post{scheduledToday !== 1 ? 's' : ''} queued</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-header"><span className="dash-stat-label">Sent Today</span><Send size={16} className="dash-icon-muted" /></div>
          <div className="dash-stat-value">{sentToday}</div>
          <div className="dash-stat-sub">{sentToday >= dailyGoal ? 'Goal hit!' : `${dailyGoal - sentToday} to daily goal`}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-header"><span className="dash-stat-label">Active Communities</span><Users size={16} className="dash-icon-muted" /></div>
          <div className="dash-stat-value">{activeCommThisWeek}</div>
          <div className="dash-stat-sub">this week</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-header"><span className="dash-stat-label">Posting Streak</span>{streak >= 3 && <Flame size={16} className="dash-flame" />}</div>
          <div className="dash-stat-value">{streak}</div>
          <div className="dash-stat-sub">{streak >= 3 ? 'On fire!' : streak > 0 ? 'Keep going!' : 'Start today'}</div>
        </div>
      </div>

      {/* Section 2 — Weekly Performance */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Weekly Performance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
            Daily goal:
            <select className="pl-filter-select" style={{ padding: '3px 6px', fontSize: 11 }} value={dailyGoal} onChange={e => { const v = Number(e.target.value); setDailyGoalState(v); saveDailyGoal(v); }}>
              {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="dash-chart dash-chart-7">
          {last7.map(d => (
            <div key={d.key} className="dash-chart-col">
              <div className="dash-chart-count">{d.count || ''}</div>
              <div className="dash-chart-bar-wrap">
                <div className={`dash-chart-bar ${d.count >= dailyGoal ? 'dash-bar-goal' : 'dash-bar-below'}`} style={{ height: `${(d.count / maxWeek) * 100}%` }} />
              </div>
              <div className="dash-chart-label">{d.dayName} {d.dayNum}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--success)', marginRight: 4 }} />Goal hit</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--muted)', opacity: 0.4, marginRight: 4 }} />Below goal</span>
        </div>
      </div>

      {/* Section 3 — Platform Breakdown */}
      {platformCards.length > 0 && (
        <div className="dash-platform-grid">
          {platformCards.map(p => (
            <div key={p.platform} className="dash-platform-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className={`platform-badge ${p.platform.toLowerCase()}`}>{p.platform}</span>
                <span className={`cred-status-badge ${p.connected > 0 ? 'cred-status-ok' : 'cred-status-missing'}`}>{p.connected > 0 ? 'Connected' : 'Not set up'}</span>
              </div>
              <div className="dash-platform-stat">{p.sentThisMonth} <span>sent this month</span></div>
              <div className="dash-platform-stat">{p.count} <span>communit{p.count !== 1 ? 'ies' : 'y'}</span></div>
              {p.nextPost && (
                <div className="dash-platform-next">
                  <Timer size={11} /> Next: {formatTime(p.nextPost.time)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Section 4 — Product Leaderboard */}
      {productLeaderboard.length > 0 && (
        <div className="card">
          <div className="card-title">Product Leaderboard (this month)</div>
          <div className="dash-leaderboard">
            {productLeaderboard.map((p, i) => (
              <div key={p.name} className="dash-leader-row">
                <div className="dash-leader-rank">{i + 1}</div>
                <div className="dash-leader-info">
                  <Package size={13} className="dash-icon-muted" />
                  <span className="dash-leader-name">{p.name}</span>
                </div>
                <div className="dash-leader-bar-wrap">
                  <div className="dash-leader-bar" style={{ width: `${(p.count / maxProductPosts) * 100}%` }} />
                </div>
                <div className="dash-leader-count">{p.count}</div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.commReached} comm.</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 5 — Community Activity Feed */}
      <div className="card">
        <div className="card-title">Activity Feed</div>
        {activityFeed.length > 0 ? (
          <div className="dash-feed">
            {activityFeed.map(entry => (
              <div key={entry.id} className="dash-feed-item">
                <span className={`log-status ${entry.status}`}>
                  {entry.status === 'success' ? <Check size={10} /> : <X size={10} />}
                </span>
                <span className="dash-feed-time">{formatDateTime(entry.date)}</span>
                {entry.productName && <span className="log-product-name">{entry.productName}</span>}
                <span className={`platform-badge ${(entry.platform || '').toLowerCase()}`}>{entry.platform}</span>
                <span className="dash-feed-comm">{entry.community}</span>
                <span className="dash-feed-preview">{(entry.content || '').slice(0, 50)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No activity yet.</p>
            {navigateTo && <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => navigateTo('generator')}>Go to Generator</button>}
          </div>
        )}
      </div>

      {/* Section 6 — Upcoming Posts */}
      {upcoming.length > 0 && (
        <div className="card">
          <div className="card-title">Upcoming Posts</div>
          <div className="dash-upcoming">
            {upcoming.map((p, i) => (
              <div key={i} className="dash-upcoming-row">
                <div className="dash-upcoming-countdown">{formatCountdown(p.time)}</div>
                <span className={`platform-badge ${p.platform.toLowerCase()}`}>{p.platform}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.community}</span>
                {p.productName && <span className="log-product-name">{p.productName}</span>}
                <span className="dash-upcoming-time">{formatTime(p.time)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
