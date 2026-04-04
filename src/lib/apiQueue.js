/**
 * API Queue Manager — rate-limits all Claude API calls and platform posts.
 * Processes one call at a time with configurable gaps.
 */
import { safeGet, safeSet } from './safeStorage';

// ============ Claude API Queue ============

const API_GAP_MS = 2000; // 2 seconds between Claude API calls
let apiQueue = [];
let apiProcessing = false;
let queueIndicator = null;

function updateQueueIndicator() {
  const count = apiQueue.length;
  if (count === 0) {
    queueIndicator?.remove();
    queueIndicator = null;
    return;
  }
  if (!queueIndicator) {
    queueIndicator = document.createElement('div');
    queueIndicator.className = 'aq-indicator';
    document.body.appendChild(queueIndicator);
  }
  if (count > 10) {
    const mins = Math.ceil((count * API_GAP_MS) / 60000);
    queueIndicator.textContent = `AI Queue: ${count} pending — ~${mins} min`;
    queueIndicator.className = 'aq-indicator aq-indicator-warn';
  } else {
    queueIndicator.textContent = `AI Queue: ${count} pending`;
    queueIndicator.className = 'aq-indicator';
  }
}

async function processApiQueue() {
  if (apiProcessing || apiQueue.length === 0) return;
  apiProcessing = true;

  while (apiQueue.length > 0) {
    const item = apiQueue.shift();
    updateQueueIndicator();
    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    }
    if (apiQueue.length > 0) {
      await new Promise(r => setTimeout(r, API_GAP_MS));
    }
  }

  apiProcessing = false;
  updateQueueIndicator();
}

/**
 * Enqueue a Claude API call.
 * @param {Function} apiCallFn - async function that makes the API call
 * @param {'high'|'normal'|'low'} priority
 * @returns {Promise} resolves with the API call result
 */
export function enqueue(apiCallFn, priority = 'normal') {
  return new Promise((resolve, reject) => {
    const item = { fn: apiCallFn, resolve, reject, priority };
    if (priority === 'high') {
      // Insert after other high-priority items but before normal/low
      const lastHigh = apiQueue.findLastIndex(i => i.priority === 'high');
      apiQueue.splice(lastHigh + 1, 0, item);
    } else if (priority === 'low') {
      apiQueue.push(item);
    } else {
      // Normal: insert before low-priority items
      const firstLow = apiQueue.findIndex(i => i.priority === 'low');
      if (firstLow === -1) apiQueue.push(item);
      else apiQueue.splice(firstLow, 0, item);
    }
    updateQueueIndicator();
    processApiQueue();
  });
}

/**
 * Get current queue size.
 */
export function getQueueSize() {
  return apiQueue.length;
}

// ============ Platform Rate Limiters ============

const PLATFORM_LIMITS = {
  Discord: { maxPerMinute: 5, retryDelay: 60000, trackKey: 'postforge_rl_discord' },
  LinkedIn: { maxPerDay: 3, retryDelay: 3600000, trackKey: 'postforge_rl_linkedin' },
  Reddit: { minGapMs: 600000, retryDelay: 600000, trackKey: 'postforge_rl_reddit' },
  X: { monthlyLimit: 1500, retryDelay: 3600000, trackKey: 'postforge_rl_twitter' },
};

function getTracker(key) { return safeGet(key, {}); }
function saveTracker(key, data) { safeSet(key, data); }

/**
 * Check if a platform post is allowed. Returns { allowed, retryAt, reason }.
 */
export function checkPlatformLimit(platform, community) {
  const config = PLATFORM_LIMITS[platform];
  if (!config) return { allowed: true };

  const tracker = getTracker(config.trackKey);
  const now = Date.now();
  const commKey = community || '_default';

  if (platform === 'Discord') {
    const recentKey = `${commKey}_recent`;
    const recent = (tracker[recentKey] || []).filter(t => now - t < 60000);
    if (recent.length >= config.maxPerMinute) {
      const retryAt = new Date(recent[0] + 60000);
      return { allowed: false, retryAt, reason: `Discord: ${config.maxPerMinute} posts/min limit — retry at ${retryAt.toLocaleTimeString()}` };
    }
  }

  if (platform === 'LinkedIn') {
    const todayKey = new Date().toISOString().split('T')[0];
    const dayKey = `${commKey}_${todayKey}`;
    if ((tracker[dayKey] || 0) >= config.maxPerDay) {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      return { allowed: false, retryAt: tomorrow, reason: `LinkedIn: ${config.maxPerDay} posts/day limit — retry tomorrow` };
    }
  }

  if (platform === 'Reddit') {
    const lastKey = `${commKey}_last`;
    const lastPost = tracker[lastKey] || 0;
    if (now - lastPost < config.minGapMs) {
      const retryAt = new Date(lastPost + config.minGapMs);
      const minsLeft = Math.ceil((config.minGapMs - (now - lastPost)) / 60000);
      return { allowed: false, retryAt, reason: `Reddit: min 10 min gap — retry in ${minsLeft} min` };
    }
  }

  if (platform === 'X') {
    const month = new Date().toISOString().slice(0, 7);
    const monthKey = `month_${month}`;
    if ((tracker[monthKey] || 0) >= config.monthlyLimit) {
      return { allowed: false, retryAt: null, reason: `Twitter/X: monthly ${config.monthlyLimit} limit reached` };
    }
  }

  return { allowed: true };
}

/**
 * Record a successful platform post for rate tracking.
 */
export function recordPlatformPost(platform, community) {
  const config = PLATFORM_LIMITS[platform];
  if (!config) return;

  const tracker = getTracker(config.trackKey);
  const now = Date.now();
  const commKey = community || '_default';

  if (platform === 'Discord') {
    const recentKey = `${commKey}_recent`;
    const recent = (tracker[recentKey] || []).filter(t => now - t < 60000);
    recent.push(now);
    tracker[recentKey] = recent;
  }

  if (platform === 'LinkedIn') {
    const todayKey = new Date().toISOString().split('T')[0];
    const dayKey = `${commKey}_${todayKey}`;
    tracker[dayKey] = (tracker[dayKey] || 0) + 1;
  }

  if (platform === 'Reddit') {
    tracker[`${commKey}_last`] = now;
  }

  if (platform === 'X') {
    const month = new Date().toISOString().slice(0, 7);
    tracker[`month_${month}`] = (tracker[`month_${month}`] || 0) + 1;
  }

  saveTracker(config.trackKey, tracker);
}

// ============ Retry Queue ============

let retryQueue = [];
let retryTimer = null;

/**
 * Add a failed post to the retry queue with a delay.
 */
export function addToRetryQueue(postFn, platform, community, delayMs) {
  const retryAt = Date.now() + delayMs;
  retryQueue.push({ fn: postFn, platform, community, retryAt });

  showRetryNotice(platform, new Date(retryAt));

  if (!retryTimer) {
    retryTimer = setInterval(processRetryQueue, 10000);
  }
}

async function processRetryQueue() {
  const now = Date.now();
  const ready = retryQueue.filter(r => now >= r.retryAt);
  retryQueue = retryQueue.filter(r => now < r.retryAt);

  for (const item of ready) {
    try {
      await item.fn();
    } catch { /* logged by failure system */ }
  }

  if (retryQueue.length === 0 && retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

function showRetryNotice(platform, retryAt) {
  const existing = document.querySelector('.aq-retry-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'aq-retry-toast';
  toast.textContent = `${platform} rate limit reached — PostForge will automatically retry at ${retryAt.toLocaleTimeString()}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}
