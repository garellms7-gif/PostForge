/**
 * PostForge Posting Safety Engine
 * Prevents bans and spam flags across platforms.
 */
import { safeGet, safeSet, safeSetRaw, safeGetRaw, safeRemove } from './safeStorage';

const DEFAULT_SAFETY = {
  redditSafeMode: true,
  spamPrevention: true,
  rateLimiting: true,
  contentSafetyCheck: true,
};

export function getSafetySettings() {
  return { ...DEFAULT_SAFETY, ...safeGet('postforge_safety', {}) };
}

export function saveSafetySettings(settings) {
  safeSet('postforge_safety', settings);
}

function getPostHistory() {
  return safeGet('postforge_post_log', []);
}

function getSafetyLog() {
  return safeGet('postforge_safety_log', []);
}

function addSafetyLogEntry(entry) {
  const log = getSafetyLog();
  log.unshift({ ...entry, date: new Date().toISOString(), id: Date.now() + Math.random() });
  safeSet('postforge_safety_log', log.slice(0, 100));
}

export { getSafetyLog };

/**
 * Run all safety checks before posting.
 * Returns { allowed: bool, warnings: string[], blocked: string|null, score: number|null }
 */
export function runSafetyChecks(content, community, platform) {
  const settings = getSafetySettings();
  const history = getPostHistory();
  const warnings = [];
  let blocked = null;

  const communityName = community?.name || '';
  const subreddit = community?.credentials?.subreddit || '';
  const now = Date.now();

  // Rate Limiting
  if (settings.rateLimiting) {
    const communityPosts = history.filter(p => p.community === communityName && p.status !== 'failed');

    if (platform === 'Discord') {
      const lastHour = communityPosts.filter(p => now - new Date(p.date).getTime() < 3600000);
      if (lastHour.length >= 5) {
        blocked = 'Discord rate limit: max 5 posts per hour per webhook. Try again later.';
        addSafetyLogEntry({ type: 'blocked', rule: 'Rate Limit', community: communityName, platform, reason: blocked });
        return { allowed: false, warnings, blocked, score: null };
      }
      if (lastHour.length >= 4) warnings.push('Approaching Discord hourly limit (4/5 used)');
    }

    if (platform === 'LinkedIn') {
      const today = communityPosts.filter(p => {
        const d = new Date(p.date);
        const n = new Date();
        return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
      });
      if (today.length >= 3) {
        blocked = 'LinkedIn rate limit: max 3 posts per day per account.';
        addSafetyLogEntry({ type: 'blocked', rule: 'Rate Limit', community: communityName, platform, reason: blocked });
        return { allowed: false, warnings, blocked, score: null };
      }
    }

    if (platform === 'Reddit') {
      const today = communityPosts.filter(p => {
        const d = new Date(p.date);
        const n = new Date();
        return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
      });
      if (today.length >= 2) {
        blocked = `Reddit rate limit: max 2 posts per day to r/${subreddit || communityName}.`;
        addSafetyLogEntry({ type: 'blocked', rule: 'Rate Limit', community: communityName, platform, reason: blocked });
        return { allowed: false, warnings, blocked, score: null };
      }
    }

    if (platform === 'X') {
      const usage = safeGet('postforge_twitter_usage', {});
      const currentMonth = new Date().toISOString().slice(0, 7);
      const count = usage.month === currentMonth ? usage.count : 0;
      if (count >= 1500) {
        blocked = 'Twitter monthly limit reached (1,500/month).';
        addSafetyLogEntry({ type: 'blocked', rule: 'Rate Limit', community: communityName, platform, reason: blocked });
        return { allowed: false, warnings, blocked, score: null };
      }
      if (count >= 1350) warnings.push(`Twitter: ${1500 - count} tweets remaining this month`);
    }
  }

  // Reddit Safe Mode
  if (settings.redditSafeMode && platform === 'Reddit') {
    const redditPosts = history.filter(p => p.community === communityName && p.status !== 'failed');

    // Check duplicate content
    const contentStart = content.slice(0, 100).toLowerCase();
    const duplicate = redditPosts.find(p => (p.content || '').toLowerCase().startsWith(contentStart));
    if (duplicate) {
      blocked = `Reddit Safe Mode: duplicate content detected for r/${subreddit || communityName}. Vary your post.`;
      addSafetyLogEntry({ type: 'blocked', rule: 'Reddit Safe Mode', community: communityName, platform, reason: blocked });
      return { allowed: false, warnings, blocked, score: null };
    }

    // Min 4 hour gap
    const lastPost = redditPosts[0];
    if (lastPost && (now - new Date(lastPost.date).getTime()) < 4 * 3600000) {
      const hoursLeft = Math.ceil((4 * 3600000 - (now - new Date(lastPost.date).getTime())) / 3600000);
      blocked = `Reddit Safe Mode: minimum 4-hour gap between posts. Wait ~${hoursLeft}h.`;
      addSafetyLogEntry({ type: 'blocked', rule: 'Reddit Safe Mode', community: communityName, platform, reason: blocked });
      return { allowed: false, warnings, blocked, score: null };
    }

    // Warn if >3 posts today
    const todayPosts = redditPosts.filter(p => {
      const d = new Date(p.date);
      const n = new Date();
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    });
    if (todayPosts.length >= 3) {
      warnings.push(`Reddit: ${todayPosts.length} posts today to r/${subreddit || communityName} — high frequency may trigger spam detection`);
    }
  }

  // Spam Prevention
  if (settings.spamPrevention) {
    // Check first line uniqueness in last 30 days
    const firstLine = content.split('\n')[0]?.trim().toLowerCase() || '';
    const thirtyDaysAgo = now - 30 * 86400000;
    const recentPosts = history.filter(p => new Date(p.date).getTime() > thirtyDaysAgo && p.status !== 'failed');
    const dupeFirstLine = recentPosts.find(p => (p.content || '').split('\n')[0]?.trim().toLowerCase() === firstLine);
    if (dupeFirstLine && firstLine.length > 10) {
      warnings.push('Spam Prevention: this opening line was used in the last 30 days — consider varying it');
    }

    // Flag overly promotional content
    const exclamationCount = (content.match(/!/g) || []).length;
    const capsWords = (content.match(/\b[A-Z]{3,}\b/g) || []).length;
    const linkCount = (content.match(/https?:\/\//g) || []).length;
    const issues = [];
    if (exclamationCount > 5) issues.push(`${exclamationCount} exclamation marks`);
    if (capsWords > 3) issues.push(`${capsWords} ALL CAPS words`);
    if (linkCount > 2) issues.push(`${linkCount} links`);
    if (issues.length > 0) {
      warnings.push(`Spam flag: looks promotional (${issues.join(', ')}). Tone it down for better engagement.`);
      addSafetyLogEntry({ type: 'warning', rule: 'Spam Prevention', community: communityName, platform, reason: `Promotional content: ${issues.join(', ')}` });
    }
  }

  // Content Safety Score (simulated — scoring heuristics)
  let score = null;
  if (settings.contentSafetyCheck) {
    score = computeAuthenticityScore(content);
    if (score < 6) {
      warnings.push(`Authenticity score: ${score}/10 — this post may sound too generic or salesy. Add personal details or questions.`);
      addSafetyLogEntry({ type: 'warning', rule: 'Content Safety', community: communityName, platform, reason: `Authenticity score ${score}/10` });
    }
  }

  if (warnings.length > 0 && !blocked) {
    for (const w of warnings) {
      addSafetyLogEntry({ type: 'warning', rule: 'Safety Check', community: communityName, platform, reason: w });
    }
  }

  return { allowed: true, warnings, blocked, score };
}

/**
 * Compute a simple authenticity score from 1-10.
 */
function computeAuthenticityScore(content) {
  let score = 7; // Start neutral-good

  const len = content.length;
  if (len < 50) score -= 2;   // Too short
  if (len > 200) score += 1;  // Some substance

  // Questions make posts feel conversational
  if ((content.match(/\?/g) || []).length > 0) score += 1;

  // Personal pronouns = authentic
  const personalWords = (content.match(/\b(I|my|me|we|our)\b/gi) || []).length;
  if (personalWords >= 2) score += 1;

  // Too many exclamation marks = salesy
  const excl = (content.match(/!/g) || []).length;
  if (excl > 3) score -= 1;
  if (excl > 6) score -= 1;

  // ALL CAPS words = spammy
  const caps = (content.match(/\b[A-Z]{4,}\b/g) || []).length;
  if (caps > 2) score -= 2;

  // Multiple links = promotional
  const links = (content.match(/https?:\/\//g) || []).length;
  if (links > 2) score -= 1;

  // Emoji = casual and authentic
  if (/[\u{1F600}-\u{1F9FF}]/u.test(content)) score += 1;

  return Math.max(1, Math.min(10, score));
}

/**
 * Add timing jitter for Reddit Safe Mode (±15 minutes in ms).
 */
export function getTimingJitter() {
  const settings = getSafetySettings();
  if (!settings.redditSafeMode) return 0;
  return Math.floor((Math.random() - 0.5) * 30 * 60 * 1000); // ±15 min
}
