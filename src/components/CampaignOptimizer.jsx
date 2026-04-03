import { useState, useMemo } from 'react';
import { Zap, AlertTriangle, Check, RefreshCw, Sparkles } from 'lucide-react';
import { calculateRawScore, getCommunityStats, normalizeScore, getScoreColor } from '../lib/scoring';
import { generatePost, resolveActiveBlocks } from '../lib/generatePost';

function getHistory() { return JSON.parse(localStorage.getItem('postforge_history') || '[]'); }
function getEngagement() { return JSON.parse(localStorage.getItem('postforge_engagement') || '{}'); }
function getCommunities() { return JSON.parse(localStorage.getItem('postforge_communities') || '[]'); }
function getProduct() { const d = localStorage.getItem('postforge_product'); return d ? JSON.parse(d) : {}; }
function getBlocks() { const d = localStorage.getItem('postforge_blocks'); return d ? JSON.parse(d) : null; }
function getQueue() { return JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]'); }
function saveQueue(q) { localStorage.setItem('postforge_approval_queue', JSON.stringify(q)); }

const POST_TYPE_MAP = {
  'Launch Announcement': 'Product launch', 'Feature Update': 'Share an update',
  'Ask for Feedback': 'Ask for help', 'Show & Tell': 'Share an update',
  'Milestone': 'General engagement', 'Tips & Value': 'General engagement',
};

const STYLE_PROMPT = (topPost, product, community, replaceType) =>
  `Analyze the following high-performing post and extract its style DNA - sentence structure, opening pattern, length, tone, use of questions, personal language level, and energy. Then write a completely NEW post about "${product.name || 'my product'}" for the "${community.name}" community that uses the SAME style DNA but is entirely original content. Never copy phrases or sentences. The topic should be "${replaceType}" but written with the energy and structure of the high performer. Return only the post text.\n\nHigh-performing post:\n${topPost}`;

async function generateStyleInspiredPost(topPostContent, product, community, replaceType) {
  const settings = JSON.parse(localStorage.getItem('postforge_settings') || '{}');
  const apiKey = settings.apiKey;

  if (apiKey && apiKey.length > 10) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system: 'You are a post writing assistant that mimics writing styles.', messages: [{ role: 'user', content: STYLE_PROMPT(topPostContent, product, community, replaceType) }] }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.content?.[0]?.text || null;
      }
    } catch { /* fall through */ }
  }

  // Fallback: generate with standard engine
  const blocks = getBlocks();
  const activeFlags = blocks ? resolveActiveBlocks(blocks, community) : {};
  return generatePost(product, community, 'Casual', 'Show & Tell', blocks, activeFlags);
}

function analyzePerformance(campaign) {
  const history = getHistory();
  const engagement = getEngagement();
  const communities = getCommunities();
  const commIds = campaign.communityIds || [];
  const results = { recommendations: [], stats: {} };

  for (const commId of commIds) {
    const comm = communities.find(c => c.id === commId);
    if (!comm) continue;
    const commName = comm.name;
    const commStats = getCommunityStats(commName);
    if (commStats.count < 5) continue;

    // Group posts by mapped type
    const typeScores = {};
    const commHistory = history.filter(h => h.community === commName);

    for (const post of commHistory) {
      const eng = engagement[post.id];
      if (!eng) continue;
      const raw = calculateRawScore(eng._platform || comm.platform, eng);
      const mapped = POST_TYPE_MAP[post.postType] || post.postType || 'General engagement';
      if (!typeScores[mapped]) typeScores[mapped] = { scores: [], posts: [] };
      typeScores[mapped].scores.push(raw);
      typeScores[mapped].posts.push({ ...post, raw });
    }

    // Find top and bottom performers
    const typeRanked = Object.entries(typeScores)
      .filter(([, d]) => d.scores.length >= 1)
      .map(([type, d]) => ({ type, avg: d.scores.reduce((s, v) => s + v, 0) / d.scores.length, count: d.scores.length, best: d.posts.sort((a, b) => b.raw - a.raw)[0] }))
      .sort((a, b) => b.avg - a.avg);

    if (typeRanked.length < 2) continue;

    const topPerformer = typeRanked[0];
    const threshold = commStats.avg * 0.7; // bottom 30%

    results.stats[commName] = { topPerformer: topPerformer.type, communityAvg: Math.round(commStats.avg), types: typeRanked };

    // Flag underperformers with 3+ posts
    for (const t of typeRanked) {
      if (t.count >= 3 && t.avg < threshold) {
        results.recommendations.push({
          id: `${commId}-${t.type}`,
          community: commName,
          communityId: commId,
          platform: comm.platform,
          underperformer: t.type,
          avgScore: Math.round(t.avg),
          communityAvg: Math.round(commStats.avg),
          topPerformerType: topPerformer.type,
          topPerformerAvg: Math.round(topPerformer.avg),
          topPostContent: topPerformer.best?.content || '',
          sampleUnderperformer: t.posts[t.posts.length - 1]?.content || '',
          count: t.count,
        });
      }
    }
  }

  return results;
}

export default function CampaignOptimizer({ campaign, onUpdateCampaign }) {
  const [analysis, setAnalysis] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [replacements, setReplacements] = useState({});
  const [submitted, setSubmitted] = useState({});

  const hasEnoughData = useMemo(() => {
    const engagement = getEngagement();
    const history = getHistory();
    const commNames = getCommunities().filter(c => campaign.communityIds.includes(c.id)).map(c => c.name);
    const tracked = history.filter(h => commNames.includes(h.community) && engagement[h.id]);
    return tracked.length >= 5;
  }, [campaign]);

  const handleAnalyze = () => {
    setAnalysis(analyzePerformance(campaign));
  };

  const handleGenerateReplacement = async (rec) => {
    setGenerating(rec.id);
    const product = getProduct();
    const comm = getCommunities().find(c => c.id === rec.communityId);
    const replacement = await generateStyleInspiredPost(rec.topPostContent, product, comm, rec.underperformer);
    setReplacements(r => ({ ...r, [rec.id]: replacement }));
    setGenerating(null);
  };

  const handleSubmitToQueue = (rec) => {
    const content = replacements[rec.id];
    if (!content) return;
    const queue = getQueue();
    queue.unshift({
      id: Date.now() + Math.random(),
      community: rec.community,
      communityId: rec.communityId,
      platform: rec.platform,
      content,
      status: 'pending',
      date: new Date().toISOString(),
      campaignId: campaign.id,
      campaignName: campaign.name,
      optimizerGenerated: true,
    });
    saveQueue(queue);
    setSubmitted(s => ({ ...s, [rec.id]: true }));
  };

  const handleToggleAutoOptimize = () => {
    if (onUpdateCampaign) {
      onUpdateCampaign(campaign.id, { autoOptimize: !campaign.autoOptimize });
    }
  };

  return (
    <div className="co-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Campaign Optimizer</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>AI analyzes engagement and suggests replacements for underperforming posts.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="toggle-wrapper" onClick={handleToggleAutoOptimize} style={{ marginLeft: 0 }}>
            <div className={`toggle ${campaign.autoOptimize ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
            <span className="toggle-label">Auto-optimize</span>
          </div>
        </div>
      </div>

      {!hasEnoughData ? (
        <div className="co-nodata">
          <AlertTriangle size={14} />
          Not enough engagement data yet. Need at least 5 tracked posts to optimize. Log engagement in History to enable.
        </div>
      ) : !analysis ? (
        <button className="btn btn-primary btn-sm" onClick={handleAnalyze}>
          <Zap size={13} /> Run Optimizer Analysis
        </button>
      ) : (
        <div>
          {/* Performance Stats */}
          {Object.entries(analysis.stats).length > 0 && (
            <div className="co-stats">
              {Object.entries(analysis.stats).map(([comm, s]) => (
                <div key={comm} className="co-stat-card">
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{comm}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Best: <span style={{ color: 'var(--success)' }}>{s.topPerformer}</span> · Avg score: {s.communityAvg}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 8 }}>
                Optimizer Recommendations ({analysis.recommendations.length})
              </div>
              {analysis.recommendations.map(rec => (
                <div key={rec.id} className="co-rec-card">
                  <div className="co-rec-header">
                    <span className={`platform-badge ${rec.platform.toLowerCase()}`}>{rec.platform}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{rec.community}</span>
                  </div>
                  <div className="co-rec-reason">
                    <AlertTriangle size={12} />
                    <strong>{rec.underperformer}</strong> is underperforming — averaging {rec.avgScore} score vs {rec.communityAvg} community average ({rec.count} posts tracked)
                  </div>

                  {/* Side by side */}
                  {replacements[rec.id] && (
                    <div className="co-compare">
                      <div className="co-compare-side">
                        <div className="co-compare-label" style={{ color: 'var(--danger)' }}>Original ({rec.underperformer})</div>
                        <div className="co-compare-text">{rec.sampleUnderperformer?.slice(0, 150)}...</div>
                        <div className="co-compare-score" style={{ color: getScoreColor(normalizeScore(rec.avgScore, getCommunityStats(rec.community))) }}>Score: {rec.avgScore}</div>
                      </div>
                      <div className="co-compare-side">
                        <div className="co-compare-label" style={{ color: 'var(--success)' }}>Replacement (inspired by {rec.topPerformerType})</div>
                        <div className="co-compare-text">{replacements[rec.id]?.slice(0, 150)}...</div>
                        <div className="co-compare-score" style={{ color: 'var(--accent)' }}>Style of top performer (avg {rec.topPerformerAvg})</div>
                      </div>
                    </div>
                  )}

                  <div className="co-rec-actions">
                    {!replacements[rec.id] && !submitted[rec.id] && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleGenerateReplacement(rec)} disabled={generating === rec.id}>
                        {generating === rec.id ? <span className="spinner" /> : <Sparkles size={12} />}
                        {generating === rec.id ? 'Generating...' : 'Generate Replacement'}
                      </button>
                    )}
                    {replacements[rec.id] && !submitted[rec.id] && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => handleSubmitToQueue(rec)}>
                          <Check size={12} /> Send to Approval Queue
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleGenerateReplacement(rec)} disabled={generating === rec.id}>
                          <RefreshCw size={12} /> Regenerate
                        </button>
                      </>
                    )}
                    {submitted[rec.id] && (
                      <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}><Check size={12} /> Submitted to queue</span>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="co-nodata" style={{ marginTop: 12 }}>
              <Check size={14} style={{ color: 'var(--success)' }} />
              No underperformers found. All post types are performing above threshold.
            </div>
          )}

          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={handleAnalyze}>
            <RefreshCw size={12} /> Re-analyze
          </button>
        </div>
      )}
    </div>
  );
}
