import { safeGet, safeSet, safeSetRaw, safeGetRaw, safeRemove } from './safeStorage';

/**
 * Get the last post dates map from localStorage.
 * Shape: { [communityName]: ISO date string }
 */
export function getLastPostDates() {
  return safeGet('postforge_last_post_dates', {});
}

export function setLastPostDate(communityName) {
  const dates = getLastPostDates();
  dates[communityName] = new Date().toISOString();
  safeSet('postforge_last_post_dates', dates);
}

/**
 * Returns 'active' | 'fading' | 'silent' | 'none' based on days since last post.
 */
export function getCommunityHealth(communityName) {
  const dates = getLastPostDates();
  const lastDate = dates[communityName];
  if (!lastDate) return 'none';
  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 7) return 'active';
  if (days <= 14) return 'fading';
  return 'silent';
}

/**
 * Returns the number of days since last post, or null if never posted.
 */
export function daysSinceLastPost(communityName) {
  const dates = getLastPostDates();
  const lastDate = dates[communityName];
  if (!lastDate) return null;
  return Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
}
