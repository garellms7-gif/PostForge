import { useState, useMemo } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Clock, Calendar, Sparkles } from 'lucide-react';
import { calculateRawScore } from '../lib/scoring';
import { buildCommunityStyleProfile } from '../lib/styleDNA';
import { getFatiguedPhrases, getTopicDistribution } from '../lib/freshness';

function getHistory() { return JSON.parse(localStorage.getItem('postforge_history') || '[]'); }
function getEngagement() { return JSON.parse(localStorage.getItem('postforge_engagement') || '{}'); }

const POST_TYPE_MAP = {
  'Launch Announcement': 'Product launch',
  'Feature Update': 'Share an update',
  'Ask for Feedback': 'Ask for help / reach',
  'Show & Tell': 'Share an update',
  'Milestone': 'General engagement',
  'Tips & Value': 'General engagement',
};

const RANKED_TYPES = ['Share an update', 'Ask for help / reach', 'Tease a roadmap feature', 'Product launch', 'General engagement'];

const MEDAL = ['🥇', '🥈', '🥉'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function computeRankings(communityName) {
  const history = getHistory().filter(h => h.community === communityName);
  const engagement = getEngagement();

  const typeData = {};
  for (const type of RANKED_TYPES) {
    typeData[type] = { posts: [], totalScore: 0, count: 0, best: null, bestScore: 0, recentScores: [], olderScores: [] };
  }

  for (const post of history) {
    const eng = engagement[post.id];
    const score = calculateRawScore(eng._platform || '', eng);
    const mappedType = POST_TYPE_MAP[post.postType] || 'General engagement';
    if (!typeData[mappedType]) continue;

    const entry = { ...post, score, eng };
    typeData[mappedType].posts.push(entry);
    if (eng) {
      typeData[mappedType].totalScore += score;
      typeData[mappedType].count++;
      if (score > typeData[mappedType].bestScore) {
        typeData[mappedType].bestScore = score;
        typeData[mappedType].best = entry;
      }
    }
  }

  // Compute trends (last 3 vs previous 3)
  for (const type of RANKED_TYPES) {
    const tracked = typeData[type].posts.filter(p => engagement[p.id]).sort((a, b) => new Date(b.date) - new Date(a.date));
    typeData[type].recentScores = tracked.slice(0, 3).map(p => p.score);
    typeData[type].olderScores = tracked.slice(3, 6).map(p => p.score);
  }

  // Rank by average score
  const ranked = RANKED_TYPES.map(type => {
    const d = typeData[type];
    const avg = d.count > 0 ? Math.round(d.totalScore / d.count) : 0;
    const recentAvg = d.recentScores.length > 0 ? d.recentScores.reduce((s, v) => s + v, 0) / d.recentScores.length : 0;
    const olderAvg = d.olderScores.length > 0 ? d.olderScores.reduce((s, v) => s + v, 0) / d.olderScores.length : 0;
    let trend = 'stable';
    if (d.recentScores.length >= 2 && d.olderScores.length >= 2) {
      if (recentAvg > olderAvg * 1.15) trend = 'improving';
      else if (recentAvg < olderAvg * 0.85) trend = 'declining';
    }
    return { type, avg, count: d.count, totalPosts: d.posts.length, trend, best: d.best };
  }).sort((a, b) => b.avg - a.avg);

  // Best day/time
  const trackedPosts = history.filter(h => engagement[h.id]);
  const dayScores = {};
  const hourScores = {};
  for (const p of trackedPosts) {
    const d = new Date(p.date);
    const day = d.getDay();
    const hour = d.getHours();
    const score = calculateRawScore(engagement[p.id]?._platform || '', engagement[p.id]);
    dayScores[day] = (dayScores[day] || []);
    dayScores[day].push(score);
    hourScores[hour] = (hourScores[hour] || []);
    hourScores[hour].push(score);
  }

  let bestDay = null;
  let bestDayAvg = 0;
  for (const [day, scores] of Object.entries(dayScores)) {
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    if (avg > bestDayAvg) { bestDayAvg = avg; bestDay = Number(day); }
  }

  let bestHour = null;
  let bestHourAvg = 0;
  for (const [hour, scores] of Object.entries(hourScores)) {
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    if (avg > bestHourAvg) { bestHourAvg = avg; bestHour = Number(hour); }
  }

  return { ranked, bestDay, bestHour, totalTracked: trackedPosts.length };
}

function formatHour(h) {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

export default function CommunityRankings({ community }) {
  const [expandedType, setExpandedType] = useState(null);
  const data = useMemo(() => computeRankings(community.name), [community.name]);

  if (data.totalTracked < 1) {
    return (
      <div className="cr-empty">
        <Trophy size={20} style={{ opacity: 0.3 }} />
        <p>No engagement data logged yet for {community.name}.</p>
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>Log engagement on posts in History to see rankings here.</p>
      </div>
    );
  }

  const best = data.ranked[0];
  const worst = data.ranked.filter(r => r.count > 0).slice(-1)[0];
  const styleProfile = buildCommunityStyleProfile(community.name);
  const fatiguedPhrases = getFatiguedPhrases(community.name);
  const topicDist = getTopicDistribution(community.name);
  const topicTotal = topicDist.reduce((s, t) => s + t.count, 0);
  const TOPIC_COLORS = ['var(--accent)', 'var(--success)', '#eab308', 'var(--danger)', '#a855f7', 'var(--muted)'];

  return (
    <div className="cr-container">
      {/* Overview card */}
      <div className="cr-overview">
        <div className="cr-overview-item">
          <span className="cr-overview-label">Best type</span>
          <span className="cr-overview-value cr-val-good">{best?.type || '—'}</span>
        </div>
        {worst && worst.type !== best?.type && (
          <div className="cr-overview-item">
            <span className="cr-overview-label">Weakest type</span>
            <span className="cr-overview-value cr-val-low">{worst.type}</span>
          </div>
        )}
        {data.bestDay !== null && (
          <div className="cr-overview-item">
            <Calendar size={12} />
            <span className="cr-overview-label">Best day</span>
            <span className="cr-overview-value">{DAY_NAMES[data.bestDay]}</span>
          </div>
        )}
        {data.bestHour !== null && (
          <div className="cr-overview-item">
            <Clock size={12} />
            <span className="cr-overview-label">Best time</span>
            <span className="cr-overview-value">{formatHour(data.bestHour)}</span>
          </div>
        )}
      </div>

      {/* Style Profile - What works here */}
      {styleProfile && styleProfile.sampleSize >= 2 && (
        <div className="cr-style-card">
          <div className="cr-style-title"><Sparkles size={13} /> What Works in {community.name}</div>
          <div className="cr-style-subtitle">Based on {styleProfile.sampleSize} high-performing posts</div>
          <div className="cr-style-grid">
            <div className="cr-style-item"><span className="cr-style-label">Opening</span><span className="cr-style-value">{styleProfile.bestOpening}</span></div>
            <div className="cr-style-item"><span className="cr-style-label">Sentences</span><span className="cr-style-value">{styleProfile.bestSentenceStyle}</span></div>
            <div className="cr-style-item"><span className="cr-style-label">Energy</span><span className="cr-style-value">{styleProfile.bestEnergy}</span></div>
            <div className="cr-style-item"><span className="cr-style-label">Structure</span><span className="cr-style-value">{styleProfile.bestStructure}</span></div>
            <div className="cr-style-item"><span className="cr-style-label">Personal</span><span className="cr-style-value">{styleProfile.bestPersonalLevel}</span></div>
            <div className="cr-style-item"><span className="cr-style-label">CTA</span><span className="cr-style-value">{styleProfile.bestCtaStyle}</span></div>
          </div>
          {styleProfile.topAuthenticityMarkers.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>What makes it land: </span>
              <span style={{ fontSize: 11, color: 'var(--success)' }}>{styleProfile.topAuthenticityMarkers.join(' · ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      <div className="cr-leaderboard">
        {data.ranked.map((r, i) => {
          const isExpanded = expandedType === r.type;
          const needsMore = r.count < 3;
          return (
            <div key={r.type} className={`cr-rank-row ${i === 0 && r.count > 0 ? 'cr-rank-top' : ''}`}>
              <div className="cr-rank-main" onClick={() => r.best && setExpandedType(isExpanded ? null : r.type)}>
                <div className="cr-rank-pos">{i < 3 && r.count > 0 ? MEDAL[i] : <span className="cr-rank-num">{i + 1}</span>}</div>
                <div className="cr-rank-info">
                  <div className="cr-rank-type">{r.type}</div>
                  {needsMore ? (
                    <div className="cr-rank-needsmore">Not enough data — needs {3 - r.count} more post{3 - r.count !== 1 ? 's' : ''}</div>
                  ) : (
                    <div className="cr-rank-stats">
                      Avg: <strong>{r.avg}</strong> · {r.count} tracked
                    </div>
                  )}
                </div>
                <div className="cr-rank-trend">
                  {r.trend === 'improving' && <span className="cr-trend cr-trend-up"><TrendingUp size={13} /> Up</span>}
                  {r.trend === 'declining' && <span className="cr-trend cr-trend-down"><TrendingDown size={13} /> Down</span>}
                  {r.trend === 'stable' && r.count >= 3 && <span className="cr-trend cr-trend-stable"><Minus size={13} /> Stable</span>}
                </div>
                {r.best && (isExpanded ? <ChevronUp size={14} className="cr-rank-chevron" /> : <ChevronDown size={14} className="cr-rank-chevron" />)}
              </div>

              {isExpanded && r.best && (
                <div className="cr-rank-best">
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Best performing post ({r.bestScore} interactions)</div>
                  <div className="cr-rank-best-text">{r.best.content?.slice(0, 200)}{(r.best.content || '').length > 200 ? '...' : ''}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Topic Distribution */}
      {topicDist.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Topic Distribution (2 weeks)</div>
          <div className="fg-topic-bar">
            {topicDist.map((t, i) => (
              <div key={t.topic} className="fg-topic-seg" style={{ flex: t.count, background: TOPIC_COLORS[i % TOPIC_COLORS.length] }} title={`${t.topic}: ${t.count}`} />
            ))}
          </div>
          <div className="fg-topic-legend">
            {topicDist.map((t, i) => (
              <span key={t.topic} className="fg-topic-legend-item">
                <span className="cal-dot" style={{ background: TOPIC_COLORS[i % TOPIC_COLORS.length] }} />
                {t.topic} ({Math.round((t.count / topicTotal) * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fatigued Phrases */}
      {fatiguedPhrases.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Fatigued Phrases This Month</div>
          <div className="fg-phrase-list">
            {fatiguedPhrases.map(f => (
              <span key={f.phrase} className="fg-phrase-tag">"{f.phrase}" <span className="fg-phrase-count">×{f.count}</span></span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
