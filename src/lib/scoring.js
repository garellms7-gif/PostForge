/**
 * Unified Engagement Scoring Engine
 * Normalizes engagement across platforms into a single 0-100 score.
 */

const SENTIMENT_BONUS = { Positive: 10, Neutral: 0, Negative: -5, Mixed: 2 };

/**
 * Calculate raw engagement points for a given platform and metrics.
 */
export function calculateRawScore(platform, metrics) {
  if (!metrics) return 0;
  const num = (k) => Number(metrics[k]) || 0;
  let raw = 0;

  switch (platform) {
    case 'Discord':
      raw = num('reactions') * 2 + num('replies') * 5;
      break;
    case 'LinkedIn':
      raw = num('likes') * 1 + num('comments') * 4 + num('shares') * 8 + Math.floor(num('impressions') / 100) * 1;
      break;
    case 'Reddit': {
      const base = num('upvotes') * 2 + num('comments') * 5;
      const ratio = num('ratio') || 100;
      raw = Math.round(base * (ratio / 100));
      break;
    }
    case 'X':
      raw = num('likes') * 1 + num('retweets') * 6 + num('replies') * 3 + Math.floor(num('impressions') / 100) * 0.5;
      break;
    default:
      // Generic: sum all numeric fields
      raw = Object.entries(metrics)
        .filter(([k]) => !k.startsWith('_') && k !== 'sentiment' && k !== 'notes' && k !== 'ratio')
        .reduce((s, [, v]) => s + (Number(v) || 0), 0);
  }

  // Sentiment bonus
  const sentiment = metrics.sentiment || metrics._sentiment;
  if (sentiment && SENTIMENT_BONUS[sentiment] !== undefined) {
    raw += SENTIMENT_BONUS[sentiment];
  }

  return Math.max(0, Math.round(raw));
}

/**
 * Get all raw scores for a community from stored engagement data.
 */
export function getCommunityScores(communityName) {
  const engagement = JSON.parse(localStorage.getItem('postforge_engagement') || '{}');
  const scores = [];
  for (const [, eng] of Object.entries(engagement)) {
    if (eng._community === communityName) {
      const raw = calculateRawScore(eng._platform, eng);
      scores.push(raw);
    }
  }
  return scores;
}

/**
 * Get community stats: average, min, max.
 */
export function getCommunityStats(communityName) {
  const scores = getCommunityScores(communityName);
  if (scores.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
  const sum = scores.reduce((s, v) => s + v, 0);
  return {
    avg: sum / scores.length,
    min: Math.min(...scores),
    max: Math.max(...scores),
    count: scores.length,
  };
}

/**
 * Normalize a raw score to 0-100 against community average.
 * 50 = community average, 100 = best ever, 0 = worst ever.
 */
export function normalizeScore(rawScore, communityStats) {
  const { avg, min, max, count } = communityStats;
  if (count < 1 || max === min) return Math.min(100, rawScore > 0 ? 50 : 0);

  if (rawScore >= avg) {
    // Map avg->max to 50->100
    const range = max - avg;
    if (range === 0) return 50;
    return Math.round(50 + ((rawScore - avg) / range) * 50);
  } else {
    // Map min->avg to 0->50
    const range = avg - min;
    if (range === 0) return 50;
    return Math.round(((rawScore - min) / range) * 50);
  }
}

/**
 * Main exported function: calculate the normalized engagement score.
 * Returns 0-100.
 */
export function calculateEngagementScore(platform, metrics, communityName) {
  const raw = calculateRawScore(platform, metrics);
  const stats = getCommunityStats(communityName);
  return normalizeScore(raw, stats);
}

/**
 * Get the color for a given normalized score.
 */
export function getScoreColor(score) {
  if (score >= 61) return 'var(--success)';
  if (score >= 31) return '#eab308';
  return 'var(--danger)';
}

/**
 * Get a label for the score.
 */
export function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 61) return 'Good';
  if (score >= 41) return 'Average';
  if (score >= 21) return 'Below Avg';
  return 'Low';
}
