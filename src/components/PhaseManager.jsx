import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { calculateRawScore, getCommunityStats, normalizeScore, getScoreColor } from '../lib/scoring';
import { buildCommunityStyleProfile } from '../lib/styleDNA';

function getEngagement() { return JSON.parse(localStorage.getItem('postforge_engagement') || '{}'); }
function getHistory() { return JSON.parse(localStorage.getItem('postforge_history') || '[]'); }
function getCommunities() { return JSON.parse(localStorage.getItem('postforge_communities') || '[]'); }

const POST_TYPES = ['Launch Announcement', 'Feature Update', 'Ask for Feedback', 'Show & Tell', 'Tips & Value'];

export function getPhaseInfo(campaign) {
  if (!campaign.smartPhases) return null;
  const start = new Date(campaign.startDate).getTime();
  const end = new Date(campaign.endDate).getTime();
  const total = end - start;
  const now = Date.now();
  const elapsed = Math.max(0, Math.min(now - start, total));
  const pct = total > 0 ? elapsed / total : 0;

  let phase = 1;
  let phaseName = 'Discovery';
  let phaseDesc = 'Testing post types and gathering baseline data';
  if (pct > 0.3 && pct <= 0.8) { phase = 2; phaseName = 'Optimization'; phaseDesc = 'Doubling down on what works'; }
  else if (pct > 0.8) { phase = 3; phaseName = 'Amplification'; phaseDesc = 'Maximum impact with proven content'; }

  const p1pct = Math.min(100, (pct / 0.3) * 100);
  const p2pct = pct > 0.3 ? Math.min(100, ((pct - 0.3) / 0.5) * 100) : 0;
  const p3pct = pct > 0.8 ? Math.min(100, ((pct - 0.8) / 0.2) * 100) : 0;

  return { phase, phaseName, phaseDesc, pct: Math.round(pct * 100), p1pct, p2pct, p3pct };
}

export function getPhasePostTypeDistribution(campaign, communityName) {
  const info = getPhaseInfo(campaign);
  if (!info) return null;

  const engagement = getEngagement();
  const history = getHistory();
  const commPosts = history.filter(h => h.community === communityName);

  // Rank post types by engagement for this community
  const typeScores = {};
  for (const post of commPosts) {
    const eng = engagement[post.id];
    if (!eng) continue;
    const raw = calculateRawScore(eng._platform || post.platform, eng);
    const type = post.postType || 'Show & Tell';
    if (!typeScores[type]) typeScores[type] = [];
    typeScores[type].push(raw);
  }

  const ranked = POST_TYPES.map(t => ({
    type: t,
    avg: (typeScores[t] || []).length > 0 ? typeScores[t].reduce((s, v) => s + v, 0) / typeScores[t].length : 0,
    count: (typeScores[t] || []).length,
  })).sort((a, b) => b.avg - a.avg);

  if (info.phase === 1) {
    // Even distribution
    return { distribution: POST_TYPES.map(t => ({ type: t, weight: 20 })), topTypes: [], phase: 1 };
  }

  if (info.phase === 2) {
    // Top 2 get 60%, rest share 40%
    const top2 = ranked.slice(0, 2).map(r => r.type);
    return {
      distribution: POST_TYPES.map(t => ({ type: t, weight: top2.includes(t) ? 30 : Math.round(40 / Math.max(1, POST_TYPES.length - 2)) })),
      topTypes: top2,
      reducedTypes: ranked.slice(2).map(r => r.type),
      phase: 2,
    };
  }

  // Phase 3: only top performer
  const topType = ranked[0]?.type || POST_TYPES[0];
  return {
    distribution: POST_TYPES.map(t => ({ type: t, weight: t === topType ? 100 : 0 })),
    topTypes: [topType],
    phase: 3,
    frequencyBoost: 1.25,
  };
}

export function generateCampaignReport(campaign) {
  const engagement = getEngagement();
  const history = getHistory();
  const communities = getCommunities();
  const commIds = campaign.communityIds || [];
  const commNames = communities.filter(c => commIds.includes(c.id)).map(c => c.name);

  const report = { postTypeWinners: {}, communityPerformance: [], styleInsights: [], totalPosts: 0, totalTracked: 0 };

  for (const comm of commNames) {
    const commPosts = history.filter(h => h.community === comm);
    const tracked = commPosts.filter(h => engagement[h.id]);
    const typeScores = {};

    for (const post of tracked) {
      const eng = engagement[post.id];
      const raw = calculateRawScore(eng._platform || post.platform, eng);
      const type = post.postType || 'Show & Tell';
      if (!typeScores[type]) typeScores[type] = [];
      typeScores[type].push(raw);
    }

    const ranked = Object.entries(typeScores)
      .map(([type, scores]) => ({ type, avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length), count: scores.length }))
      .sort((a, b) => b.avg - a.avg);

    const winner = ranked[0];
    if (winner) report.postTypeWinners[comm] = winner.type;

    report.communityPerformance.push({
      community: comm,
      platform: communities.find(c => c.name === comm)?.platform || '',
      totalPosts: commPosts.length,
      tracked: tracked.length,
      bestType: winner?.type || 'N/A',
      bestAvg: winner?.avg || 0,
    });

    const styleProfile = buildCommunityStyleProfile(comm);
    if (styleProfile && styleProfile.sampleSize > 0) {
      report.styleInsights.push({ community: comm, ...styleProfile });
    }

    report.totalPosts += commPosts.length;
    report.totalTracked += tracked.length;
  }

  return report;
}

export function PhaseProgressBar({ campaign }) {
  const info = getPhaseInfo(campaign);
  if (!info) return null;

  return (
    <div className="pm-progress">
      <div className="pm-progress-header">
        <span className="pm-phase-badge">{info.phaseName}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{info.phaseDesc}</span>
      </div>
      <div className="pm-progress-bars">
        <div className="pm-progress-segment">
          <div className="pm-progress-label">Discovery</div>
          <div className="pm-progress-track"><div className="pm-progress-fill pm-fill-1" style={{ width: `${info.p1pct}%` }} /></div>
        </div>
        <div className="pm-progress-segment pm-seg-wide">
          <div className="pm-progress-label">Optimization</div>
          <div className="pm-progress-track"><div className="pm-progress-fill pm-fill-2" style={{ width: `${info.p2pct}%` }} /></div>
        </div>
        <div className="pm-progress-segment">
          <div className="pm-progress-label">Amplification</div>
          <div className="pm-progress-track"><div className="pm-progress-fill pm-fill-3" style={{ width: `${info.p3pct}%` }} /></div>
        </div>
      </div>
    </div>
  );
}

export function CampaignReportCard({ campaign }) {
  const report = useMemo(() => generateCampaignReport(campaign), [campaign]);

  return (
    <div className="pm-report">
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={14} /> Campaign Report
      </div>
      <div className="pm-report-stats">
        <div className="pm-report-stat"><strong>{report.totalPosts}</strong> posts</div>
        <div className="pm-report-stat"><strong>{report.totalTracked}</strong> tracked</div>
        <div className="pm-report-stat"><strong>{report.communityPerformance.length}</strong> communities</div>
      </div>
      {report.communityPerformance.map(c => (
        <div key={c.community} className="pm-report-row">
          <span className={`platform-badge ${c.platform.toLowerCase()}`}>{c.platform}</span>
          <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{c.community}</span>
          <span style={{ fontSize: 11, color: 'var(--success)' }}>Best: {c.bestType}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Avg: {c.bestAvg}</span>
        </div>
      ))}
      {report.styleInsights.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Style DNA Insights</div>
          {report.styleInsights.map(s => (
            <div key={s.community} style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
              <strong>{s.community}</strong>: {s.bestOpening} opening, {s.bestEnergy} energy, {s.bestStructure} structure
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
