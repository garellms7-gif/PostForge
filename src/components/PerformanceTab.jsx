import { useState, useMemo } from 'react';
import { Trophy, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateRawScore, getCommunityStats, normalizeScore, getScoreColor } from '../lib/scoring';

function getHistory() { return JSON.parse(localStorage.getItem('postforge_history') || '[]'); }
function getEngagement() { return JSON.parse(localStorage.getItem('postforge_engagement') || '{}'); }
function getCommunities() { return JSON.parse(localStorage.getItem('postforge_communities') || '[]'); }

const POST_TYPES = ['Launch Announcement', 'Feature Update', 'Ask for Feedback', 'Show & Tell', 'Milestone', 'Tips & Value'];
const PLATFORM_COLORS = { Discord: '#5865f2', LinkedIn: '#0a66c2', Reddit: '#ff4500', X: '#a0a0a0' };

function toWeekKey(d) { const jan1 = new Date(d.getFullYear(), 0, 1); return `${d.getFullYear()}-W${String(Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)).padStart(2, '0')}`; }

export default function PerformanceTab() {
  const [expandedPost, setExpandedPost] = useState(null);

  const data = useMemo(() => {
    const history = getHistory();
    const engagement = getEngagement();
    const communities = getCommunities();
    const commNames = communities.map(c => c.name);

    // All tracked posts with scores
    const tracked = [];
    for (const post of history) {
      const eng = engagement[post.id];
      if (!eng) continue;
      const raw = calculateRawScore(eng._platform || post.platform, eng);
      const stats = getCommunityStats(post.community);
      const normalized = normalizeScore(raw, stats);
      tracked.push({ ...post, raw, normalized, eng });
    }

    // Section 1 — Hall of Fame (top 5 by normalized score)
    const hallOfFame = [...tracked].sort((a, b) => b.normalized - a.normalized).slice(0, 5);

    // Section 2 — Post Type Performance Matrix
    const matrix = {};
    for (const type of POST_TYPES) {
      matrix[type] = {};
      for (const comm of commNames) {
        const posts = tracked.filter(p => p.postType === type && p.community === comm);
        matrix[type][comm] = posts.length >= 2 ? Math.round(posts.reduce((s, p) => s + p.normalized, 0) / posts.length) : null;
      }
    }

    // Section 3 — Trend lines (last 8 weeks per community)
    const last8Weeks = [];
    for (let i = 7; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i * 7); last8Weeks.push(toWeekKey(d)); }
    const uniqueWeeks = [...new Set(last8Weeks)].slice(-8);

    const trendLines = {};
    for (const comm of commNames) {
      trendLines[comm] = uniqueWeeks.map(wk => {
        const weekPosts = tracked.filter(p => p.community === comm && toWeekKey(new Date(p.date)) === wk);
        return weekPosts.length > 0 ? Math.round(weekPosts.reduce((s, p) => s + p.normalized, 0) / weekPosts.length) : null;
      });
    }
    // Only include communities with some data
    const trendComms = Object.entries(trendLines).filter(([, vals]) => vals.some(v => v !== null));
    const trendMax = Math.max(1, ...trendComms.flatMap(([, v]) => v.filter(x => x !== null)));

    // Section 4 — Content Fatigue
    const fatigue = [];
    for (const comm of commNames) {
      const commTracked = tracked.filter(p => p.community === comm).sort((a, b) => new Date(b.date) - new Date(a.date));
      const recent4w = commTracked.filter(p => (Date.now() - new Date(p.date).getTime()) < 28 * 86400000);
      const prev4w = commTracked.filter(p => { const age = Date.now() - new Date(p.date).getTime(); return age >= 28 * 86400000 && age < 56 * 86400000; });
      if (recent4w.length >= 2 && prev4w.length >= 2) {
        const recentAvg = recent4w.reduce((s, p) => s + p.normalized, 0) / recent4w.length;
        const prevAvg = prev4w.reduce((s, p) => s + p.normalized, 0) / prev4w.length;
        if (prevAvg > 0 && recentAvg < prevAvg * 0.8) {
          const drop = Math.round((1 - recentAvg / prevAvg) * 100);
          // Suggest the best performing type they haven't used recently
          const recentTypes = new Set(recent4w.map(p => p.postType));
          const suggestion = POST_TYPES.find(t => !recentTypes.has(t)) || 'a different post type';
          fatigue.push({ community: comm, platform: communities.find(c => c.name === comm)?.platform || '', drop, suggestion });
        }
      }
    }

    // Section 5 — Win Rate by Platform
    const winRate = {};
    for (const p of ['Discord', 'LinkedIn', 'Reddit', 'X']) {
      const platformPosts = tracked.filter(t => (t.platform || t.eng?._platform) === p);
      if (platformPosts.length < 1) continue;
      const wins = platformPosts.filter(t => t.normalized >= 60).length;
      winRate[p] = { total: platformPosts.length, wins, rate: Math.round((wins / platformPosts.length) * 100) };
    }
    const maxWinRate = Math.max(1, ...Object.values(winRate).map(w => w.rate));

    return { hallOfFame, matrix, commNames: commNames.filter(c => tracked.some(t => t.community === c)), uniqueWeeks, trendComms, trendMax, fatigue, winRate, maxWinRate, hasData: tracked.length > 0 };
  }, []);

  if (!data.hasData) {
    return (
      <div className="empty-state" style={{ padding: 32 }}>
        <Trophy size={36} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 8 }} />
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>No engagement data yet. Log engagement on posts in History to see performance analytics.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Section 1 — Hall of Fame */}
      <div className="card">
        <div className="card-title"><Trophy size={15} style={{ color: '#eab308', verticalAlign: '-2px' }} /> Top Posts Hall of Fame</div>
        <div className="pf-hof">
          {data.hallOfFame.map((p, i) => (
            <div key={p.id} className="pf-hof-item" onClick={() => setExpandedPost(expandedPost === p.id ? null : p.id)}>
              <div className="pf-hof-rank">{i + 1}</div>
              <svg width={32} height={32} className="eng-gauge">
                <circle cx={16} cy={16} r={13} fill="none" stroke="var(--border)" strokeWidth={2.5} />
                <circle cx={16} cy={16} r={13} fill="none" stroke={getScoreColor(p.normalized)} strokeWidth={2.5}
                  strokeDasharray={2 * Math.PI * 13} strokeDashoffset={2 * Math.PI * 13 * (1 - p.normalized / 100)} strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
                <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize="9" fontWeight="700" fill={getScoreColor(p.normalized)}>{p.normalized}</text>
              </svg>
              <div className="pf-hof-info">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className={`platform-badge ${(p.platform || '').toLowerCase()}`}>{p.platform}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.community}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{p.postType}</span>
                </div>
                <div className="pf-hof-preview">{(p.content || '').slice(0, 100)}{(p.content || '').length > 100 ? '...' : ''}</div>
              </div>
              {expandedPost === p.id ? <ChevronUp size={14} className="dash-icon-muted" /> : <ChevronDown size={14} className="dash-icon-muted" />}
              {expandedPost === p.id && (
                <div className="pf-hof-full" onClick={e => e.stopPropagation()}>{p.content}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section 2 — Performance Matrix */}
      {data.commNames.length > 0 && (
        <div className="card">
          <div className="card-title">Post Type Performance Matrix</div>
          <div className="pf-matrix-wrap">
            <table className="pf-matrix">
              <thead>
                <tr><th></th>{data.commNames.map(c => <th key={c}>{c.slice(0, 12)}</th>)}</tr>
              </thead>
              <tbody>
                {POST_TYPES.map(type => (
                  <tr key={type}>
                    <td className="pf-matrix-type">{type}</td>
                    {data.commNames.map(comm => {
                      const val = data.matrix[type]?.[comm];
                      const color = val === null ? 'var(--border)' : getScoreColor(val);
                      return <td key={comm}><span className="pf-matrix-cell" style={{ background: color + '22', color }}>{val !== null ? val : '—'}</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 3 — Trend Lines */}
      {data.trendComms.length > 0 && (
        <div className="card">
          <div className="card-title">Engagement Trends (8 weeks)</div>
          <div className="pf-trend-chart">
            {data.uniqueWeeks.map((wk, wi) => (
              <div key={wk} className="pf-trend-col">
                <div className="pf-trend-bars">
                  {data.trendComms.map(([comm, vals]) => {
                    const val = vals[wi];
                    const platform = getCommunities().find(c => c.name === comm)?.platform || '';
                    const color = PLATFORM_COLORS[platform] || 'var(--accent)';
                    return val !== null ? (
                      <div key={comm} className="pf-trend-dot" style={{ bottom: `${(val / data.trendMax) * 90}%`, background: color }} title={`${comm}: ${val}`} />
                    ) : null;
                  })}
                </div>
                <div className="pf-trend-label">W{wk.split('-W')[1]}</div>
              </div>
            ))}
          </div>
          <div className="pf-trend-legend">
            {data.trendComms.map(([comm]) => {
              const platform = getCommunities().find(c => c.name === comm)?.platform || '';
              return <span key={comm} className="pf-trend-legend-item"><span className="cal-dot" style={{ background: PLATFORM_COLORS[platform] || 'var(--accent)' }} />{comm}</span>;
            })}
          </div>
        </div>
      )}

      {/* Section 4 — Content Fatigue */}
      {data.fatigue.length > 0 && (
        <div className="card">
          <div className="card-title"><AlertTriangle size={14} style={{ color: '#eab308' }} /> Content Fatigue Detected</div>
          {data.fatigue.map(f => (
            <div key={f.community} className="pf-fatigue-card">
              <span className={`platform-badge ${f.platform.toLowerCase()}`}>{f.platform}</span>
              <strong>{f.community}</strong> engagement is down {f.drop}% — try switching to <em>{f.suggestion}</em> or taking a short break.
            </div>
          ))}
        </div>
      )}

      {/* Section 5 — Win Rate by Platform */}
      {Object.keys(data.winRate).length > 0 && (
        <div className="card">
          <div className="card-title">Win Rate by Platform (score {'>'} 60)</div>
          <div className="pf-winrate">
            {Object.entries(data.winRate).sort((a, b) => b[1].rate - a[1].rate).map(([platform, w]) => (
              <div key={platform} className="pf-winrate-row">
                <span className={`platform-badge ${platform.toLowerCase()}`}>{platform}</span>
                <div className="pf-winrate-bar-wrap">
                  <div className="pf-winrate-bar" style={{ width: `${(w.rate / data.maxWinRate) * 100}%`, background: PLATFORM_COLORS[platform] || 'var(--accent)' }} />
                </div>
                <span className="pf-winrate-pct">{w.rate}%</span>
                <span className="pf-winrate-detail">{w.wins}/{w.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
