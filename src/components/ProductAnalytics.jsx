import { useState, useMemo } from 'react';
import { X, Download, Star, Clock } from 'lucide-react';
import { getCommunityHealth, daysSinceLastPost } from '../lib/health';

function getPostLog() { return JSON.parse(localStorage.getItem('postforge_post_log') || '[]'); }
function getHistory() { return JSON.parse(localStorage.getItem('postforge_history') || '[]'); }
function getTopPosts() { return JSON.parse(localStorage.getItem('postforge_top_posts') || '[]'); }
function getCommunities() { return JSON.parse(localStorage.getItem('postforge_communities') || '[]'); }
function getLastPostDates() { return JSON.parse(localStorage.getItem('postforge_last_post_dates') || '{}'); }

function toWeekKey(iso) {
  const d = new Date(iso);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProductAnalytics({ product, onClose }) {
  const productName = product.name || '';

  const data = useMemo(() => {
    const log = getPostLog();
    const history = getHistory();
    const topPosts = getTopPosts();
    const communities = getCommunities();
    const lastDates = getLastPostDates();

    // Filter to this product
    const productLog = log.filter(l => l.productName === productName);
    const productHistory = history.filter(h => {
      // History doesn't always have productName, match by content overlap or all if product is loaded
      return true; // Include all history for now, filter by community overlap
    });

    const sentLog = productLog.filter(l => l.status === 'success');
    const allPosts = [...productLog, ...productHistory];

    // Communities posted to
    const commCounts = {};
    for (const p of allPosts) {
      if (p.community) commCounts[p.community] = (commCounts[p.community] || 0) + 1;
    }

    // This week / this month
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisWeek = allPosts.filter(p => new Date(p.date) >= weekStart).length;
    const thisMonth = allPosts.filter(p => new Date(p.date) >= monthStart).length;

    // Posts per week (last 8 weeks)
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      weeks.push(toWeekKey(d.toISOString()));
    }
    const uniqueWeeks = [...new Set(weeks)].slice(-8);
    const postsByWeek = uniqueWeeks.map(wk => {
      const count = allPosts.filter(p => toWeekKey(p.date) === wk).length;
      return { week: wk, count };
    });
    const maxWeek = Math.max(1, ...postsByWeek.map(w => w.count));

    // Top performers
    const topPerformers = topPosts.filter(t => {
      return Object.keys(commCounts).includes(t.community);
    }).slice(0, 5);

    // Community reach
    const reach = Object.entries(commCounts).map(([name, count]) => {
      const comm = communities.find(c => c.name === name);
      const health = getCommunityHealth(name);
      const days = daysSinceLastPost(name);
      return { name, count, platform: comm?.platform || '', health, days };
    }).sort((a, b) => b.count - a.count);

    // Changelog
    const blocks = product.blocks || JSON.parse(localStorage.getItem('postforge_blocks') || '{}');
    const changelog = (blocks.updateLog?.entries || []).sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      totalGenerated: allPosts.length,
      totalSent: sentLog.length,
      commCounts,
      thisWeek,
      thisMonth,
      postsByWeek,
      maxWeek,
      topPerformers,
      reach,
      changelog,
    };
  }, [productName, product]);

  const handleExport = () => {
    const lines = [
      `PostForge Analytics — ${productName}`,
      `Exported: ${new Date().toLocaleString()}`,
      '',
      `Total posts generated: ${data.totalGenerated}`,
      `Total posts sent: ${data.totalSent}`,
      `Posts this week: ${data.thisWeek}`,
      `Posts this month: ${data.thisMonth}`,
      '',
      'Communities reached:',
      ...data.reach.map(r => `  ${r.name} (${r.platform}): ${r.count} posts — ${r.health}`),
      '',
      'Weekly activity (last 8 weeks):',
      ...data.postsByWeek.map(w => `  ${w.week}: ${w.count} posts${w.count === 0 ? ' (silent)' : ''}`),
      '',
      'Top performing posts:',
      ...data.topPerformers.map((p, i) => `  ${i + 1}. [${p.community}] ${p.content?.slice(0, 100)}...`),
      '',
      'Changelog:',
      ...data.changelog.map(e => `  ${e.date}: ${e.change}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postforge-analytics-${productName.replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const healthBadge = (h) => {
    if (h === 'active') return <span className="health-badge health-active">Active</span>;
    if (h === 'fading') return <span className="health-badge health-fading">Fading</span>;
    if (h === 'silent') return <span className="health-badge health-silent">Silent</span>;
    return <span className="health-badge health-none">No posts</span>;
  };

  return (
    <div className="pa-overlay" onClick={onClose}>
      <div className="pa-panel" onClick={e => e.stopPropagation()}>
        <div className="pa-header">
          <div>
            <div className="pa-title">{productName} Analytics</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{product.tagline || ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={13} /> Export</button>
            <button className="pa-close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Stats row */}
        <div className="pa-stats-row">
          <div className="pa-stat"><div className="pa-stat-val">{data.totalGenerated}</div><div className="pa-stat-label">Generated</div></div>
          <div className="pa-stat"><div className="pa-stat-val">{data.totalSent}</div><div className="pa-stat-label">Sent</div></div>
          <div className="pa-stat"><div className="pa-stat-val">{data.thisWeek}</div><div className="pa-stat-label">This Week</div></div>
          <div className="pa-stat"><div className="pa-stat-val">{data.thisMonth}</div><div className="pa-stat-label">This Month</div></div>
          <div className="pa-stat"><div className="pa-stat-val">{Object.keys(data.commCounts).length}</div><div className="pa-stat-label">Communities</div></div>
        </div>

        {/* Performance Timeline */}
        <div className="pa-section">
          <div className="pa-section-title">Performance Timeline (8 weeks)</div>
          <div className="pa-chart">
            {data.postsByWeek.map(w => (
              <div key={w.week} className="pa-chart-col">
                <div className="pa-chart-count">{w.count || ''}</div>
                <div className="pa-chart-bar-wrap">
                  <div className={`pa-chart-bar ${w.count === 0 ? 'pa-chart-bar-silent' : ''}`} style={{ height: `${Math.max(4, (w.count / data.maxWeek) * 100)}%` }} />
                </div>
                <div className="pa-chart-label">{w.week.split('-W')[1]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Community Reach */}
        <div className="pa-section">
          <div className="pa-section-title">Community Reach</div>
          {data.reach.length > 0 ? (
            <div className="pa-reach-list">
              {data.reach.map(r => (
                <div key={r.name} className="pa-reach-row">
                  <span className={`platform-badge ${r.platform.toLowerCase()}`}>{r.platform}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{r.name}</span>
                  {healthBadge(r.health)}
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{r.count} posts</span>
                  {r.days !== null && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.days}d ago</span>}
                </div>
              ))}
            </div>
          ) : <p style={{ fontSize: 13, color: 'var(--muted)' }}>No communities reached yet.</p>}
        </div>

        {/* Top Performers */}
        {data.topPerformers.length > 0 && (
          <div className="pa-section">
            <div className="pa-section-title"><Star size={14} fill="var(--accent)" color="var(--accent)" /> Top Performing Posts</div>
            {data.topPerformers.map(p => (
              <div key={p.id} className="pa-top-post">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <span className={`platform-badge ${(p.platform || '').toLowerCase()}`}>{p.platform}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.community}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{p.content?.slice(0, 150)}...</div>
              </div>
            ))}
          </div>
        )}

        {/* Changelog */}
        {data.changelog.length > 0 && (
          <div className="pa-section" style={{ borderBottom: 'none' }}>
            <div className="pa-section-title"><Clock size={14} /> Product Changelog</div>
            <div className="pa-timeline">
              {data.changelog.map(e => (
                <div key={e.id} className="pa-timeline-item">
                  <div className="pa-timeline-dot" />
                  <div className="pa-timeline-date">{e.date}</div>
                  <div className="pa-timeline-text">{e.change}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
