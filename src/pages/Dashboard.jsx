import { useState, useEffect } from 'react';
import { Flame, TrendingUp, Users, Package, BarChart2 } from 'lucide-react';

function getHistory() {
  return JSON.parse(localStorage.getItem('postforge_history') || '[]');
}

function getPostLog() {
  return JSON.parse(localStorage.getItem('postforge_post_log') || '[]');
}

function getCommunities() {
  return JSON.parse(localStorage.getItem('postforge_communities') || '[]');
}

function getProducts() {
  return JSON.parse(localStorage.getItem('postforge_products') || '[]');
}

function toDateKey(iso) {
  return new Date(iso).toISOString().split('T')[0];
}

function calcStreak(allDates) {
  if (allDates.length === 0) return 0;
  const unique = [...new Set(allDates.map(toDateKey))].sort().reverse();
  const today = toDateKey(new Date().toISOString());
  const yesterday = toDateKey(new Date(Date.now() - 86400000).toISOString());

  // Streak must include today or yesterday
  if (unique[0] !== today && unique[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1]);
    const curr = new Date(unique[i]);
    const diff = (prev - curr) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(now);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getLast14Days() {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toDateKey(d.toISOString()));
  }
  return days;
}

export default function Dashboard() {
  const [history, setHistory] = useState([]);
  const [postLog, setPostLog] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    setHistory(getHistory());
    setPostLog(getPostLog());
    setCommunities(getCommunities());
    setProducts(getProducts());
  }, []);

  // All post dates (from history + post log)
  const allDates = [
    ...history.map(h => h.date),
    ...postLog.map(l => l.date),
  ].filter(Boolean);

  // 1. Posting Streak
  const streak = calcStreak(allDates);

  // 2. This Week
  const weekStart = getWeekStart();
  const thisWeekHistory = history.filter(h => new Date(h.date) >= weekStart);
  const thisWeekLog = postLog.filter(l => new Date(l.date) >= weekStart);
  const weekPosts = thisWeekHistory.length + thisWeekLog.length;
  const weekCommunities = new Set([
    ...thisWeekHistory.map(h => h.community),
    ...thisWeekLog.map(l => l.community),
  ].filter(Boolean)).size;

  // 3. Total Reach
  const totalCommunities = communities.length;

  // 4. Product Activity
  const productActivity = products.map(p => {
    const count = postLog.filter(l => l.productName === p.name).length;
    return { name: p.name || 'Untitled', count };
  });

  // 5. Posts per day (last 14 days)
  const last14 = getLast14Days();
  const postsByDay = last14.map(day => {
    const count = allDates.filter(d => toDateKey(d) === day).length;
    return { day, count };
  });
  const maxPosts = Math.max(1, ...postsByDay.map(d => d.count));

  // 6. Community Leaderboard
  const communityCounts = {};
  for (const entry of [...history, ...postLog]) {
    const name = entry.community;
    if (name) communityCounts[name] = (communityCounts[name] || 0) + 1;
  }
  const leaderboard = Object.entries(communityCounts)
    .map(([name, count]) => {
      const comm = communities.find(c => c.name === name);
      return { name, count, platform: comm?.platform || '' };
    })
    .sort((a, b) => b.count - a.count);
  const maxLeaderboard = Math.max(1, leaderboard[0]?.count || 1);

  const formatDayLabel = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  };

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Your PostForge momentum at a glance.</p>

      {/* Stat cards row */}
      <div className="dash-stats-grid">
        <div className="dash-stat-card">
          <div className="dash-stat-header">
            <span className="dash-stat-label">Posting Streak</span>
            {streak >= 3 && <Flame size={18} className="dash-flame" />}
          </div>
          <div className="dash-stat-value">{streak} day{streak !== 1 ? 's' : ''}</div>
          <div className="dash-stat-sub">{streak >= 3 ? 'On fire!' : streak > 0 ? 'Keep going!' : 'Start posting today'}</div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-header">
            <span className="dash-stat-label">This Week</span>
            <TrendingUp size={18} className="dash-icon-muted" />
          </div>
          <div className="dash-stat-value">{weekPosts}</div>
          <div className="dash-stat-sub">{weekCommunities} communit{weekCommunities !== 1 ? 'ies' : 'y'} reached</div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-header">
            <span className="dash-stat-label">Total Reach</span>
            <Users size={18} className="dash-icon-muted" />
          </div>
          <div className="dash-stat-value">{totalCommunities}</div>
          <div className="dash-stat-sub">communit{totalCommunities !== 1 ? 'ies' : 'y'} connected</div>
        </div>
      </div>

      {/* Bar chart — last 14 days */}
      <div className="card">
        <div className="card-title">Posts — Last 14 Days</div>
        <div className="dash-chart">
          {postsByDay.map(d => (
            <div key={d.day} className="dash-chart-col">
              <div className="dash-chart-count">{d.count || ''}</div>
              <div className="dash-chart-bar-wrap">
                <div
                  className="dash-chart-bar"
                  style={{ height: `${(d.count / maxPosts) * 100}%` }}
                />
              </div>
              <div className="dash-chart-label">{formatDayLabel(d.day)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Community Leaderboard */}
      <div className="card">
        <div className="card-title">Community Leaderboard</div>
        {leaderboard.length > 0 ? (
          <div className="dash-leaderboard">
            {leaderboard.map((c, i) => (
              <div key={c.name} className="dash-leader-row">
                <div className="dash-leader-rank">{i + 1}</div>
                <div className="dash-leader-info">
                  {c.platform && <span className={`platform-badge ${c.platform.toLowerCase()}`}>{c.platform}</span>}
                  <span className="dash-leader-name">{c.name}</span>
                </div>
                <div className="dash-leader-bar-wrap">
                  <div className="dash-leader-bar" style={{ width: `${(c.count / maxLeaderboard) * 100}%` }} />
                </div>
                <div className="dash-leader-count">{c.count}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No posts yet. Generate and save posts to see your leaderboard.</p>
        )}
      </div>

      {/* Product Activity */}
      {productActivity.length > 0 && (
        <div className="card">
          <div className="card-title">Product Activity</div>
          <div className="dash-product-list">
            {productActivity.map(p => (
              <div key={p.name} className="dash-product-row">
                <div className="dash-product-info">
                  <Package size={14} className="dash-icon-muted" />
                  <span>{p.name}</span>
                </div>
                <span className="dash-product-count">{p.count} post{p.count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
