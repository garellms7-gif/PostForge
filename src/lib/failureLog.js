/**
 * Failure Detection and Logging System for PostForge.
 */
import { safeGet, safeSet } from './safeStorage';

const FAILURE_CATEGORIES = {
  auth: { label: 'Auth Failed', color: 'var(--danger)', fix: (platform, community) => `Your ${platform} token has expired — update it in Communities > ${community} > Settings` },
  rate_limit: { label: 'Rate Limited', color: '#eab308', fix: () => 'Too many posts sent too quickly — PostForge will retry in 60 minutes automatically' },
  connection: { label: 'Connection Error', color: 'var(--muted)', fix: (platform) => `Could not reach ${platform} — check your internet connection and retry` },
  duplicate: { label: 'Duplicate Content', color: '#a855f7', fix: () => 'Platform rejected duplicate content — PostForge rewrote it, review and resend' },
  send: { label: 'Send Failed', color: 'var(--danger)', fix: (platform) => `Failed to post to ${platform} — check your credentials and try again` },
};

/**
 * Classify an error message into a failure category.
 */
function classifyError(errorMsg) {
  const msg = (errorMsg || '').toLowerCase();
  if (msg.includes('401') || msg.includes('auth') || msg.includes('token') || msg.includes('expired') || msg.includes('unauthorized')) return 'auth';
  if (msg.includes('429') || msg.includes('rate') || msg.includes('limit') || msg.includes('too many')) return 'rate_limit';
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('connect') || msg.includes('timeout') || msg.includes('ECONNREFUSED')) return 'connection';
  if (msg.includes('duplicate') || msg.includes('already') || msg.includes('identical')) return 'duplicate';
  return 'send';
}

/**
 * Log a posting failure.
 */
export function logFailure(type, community, platform, error, postPreview = '') {
  const failures = getFailures();
  const category = type || classifyError(error);
  failures.unshift({
    id: Date.now() + Math.random(),
    category,
    community: community || 'Unknown',
    platform: platform || 'Unknown',
    error: error || 'Unknown error',
    postPreview: (postPreview || '').slice(0, 200),
    retryCount: 0,
    resolved: false,
    date: new Date().toISOString(),
  });
  safeSet('postforge_failures', failures.slice(0, 50));

  // Show toast notification
  showFailureToast(community, error);
}

/**
 * Get all failures.
 */
export function getFailures() {
  return safeGet('postforge_failures', []);
}

/**
 * Get unresolved failure count.
 */
export function getUnresolvedCount() {
  return getFailures().filter(f => !f.resolved).length;
}

/**
 * Mark a failure as resolved (dismissed).
 */
export function resolveFailure(id) {
  const failures = getFailures().map(f => f.id === id ? { ...f, resolved: true } : f);
  safeSet('postforge_failures', failures);
}

/**
 * Increment retry count for a failure.
 */
export function incrementRetry(id) {
  const failures = getFailures().map(f => f.id === id ? { ...f, retryCount: f.retryCount + 1, lastRetry: new Date().toISOString() } : f);
  safeSet('postforge_failures', failures);
}

/**
 * Remove a failure entirely.
 */
export function removeFailure(id) {
  const failures = getFailures().filter(f => f.id !== id);
  safeSet('postforge_failures', failures);
}

/**
 * Clear all resolved failures.
 */
export function clearResolved() {
  const failures = getFailures().filter(f => !f.resolved);
  safeSet('postforge_failures', failures);
}

/**
 * Get category info for a failure.
 */
export function getCategoryInfo(category) {
  return FAILURE_CATEGORIES[category] || FAILURE_CATEGORIES.send;
}

/**
 * Show a failure toast notification (10 seconds).
 */
function showFailureToast(community, error) {
  const existing = document.querySelector('.fl-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'fl-toast';
  const shortError = (error || 'Unknown error').slice(0, 60);
  toast.innerHTML = `<strong>${community || 'Post'}</strong> failed: ${shortError} — <span style="text-decoration:underline;cursor:pointer">view</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 10000);
}
