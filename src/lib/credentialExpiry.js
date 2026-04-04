/**
 * Platform Credential Expiry Tracking System.
 */
import { safeGet, safeSet } from './safeStorage';

/**
 * Get credential health for a community.
 * Returns { status: 'healthy'|'warning'|'expiring'|'expired'|'unknown', message, daysLeft?, usageInfo? }
 */
export function getCredentialHealth(community) {
  const platform = community.platform;
  const creds = community.credentials || {};

  if (platform === 'LinkedIn') {
    const tokenCreated = creds.tokenCreated || creds.tokenExpiry;
    if (!creds.accessToken) return { status: 'unknown', message: 'Not configured' };
    if (!tokenCreated) return { status: 'healthy', message: 'Token set (no expiry date)' };

    // If tokenCreated is a future date, treat it as expiry date directly
    let expiryDate;
    const created = new Date(tokenCreated);
    if (creds.tokenExpiry) {
      expiryDate = new Date(creds.tokenExpiry);
    } else {
      expiryDate = new Date(created.getTime() + 60 * 86400000);
    }

    const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / 86400000);
    if (daysLeft <= 0) return { status: 'expired', message: 'Token expired', daysLeft: 0 };
    if (daysLeft <= 7) return { status: 'expiring', message: `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`, daysLeft };
    if (daysLeft <= 14) return { status: 'warning', message: `Expires in ${daysLeft} days`, daysLeft };
    return { status: 'healthy', message: `Expires in ${daysLeft} days`, daysLeft };
  }

  if (platform === 'Reddit') {
    if (!creds.appId || !creds.username) return { status: 'unknown', message: 'Not configured' };
    const tracker = safeGet('postforge_cred_tracker', {});
    const lastSuccess = tracker[`reddit_${community.id}_last_success`];
    if (lastSuccess) {
      const daysSince = Math.floor((Date.now() - new Date(lastSuccess).getTime()) / 86400000);
      if (daysSince > 14) return { status: 'warning', message: `No successful post in ${daysSince} days — test your connection`, daysLeft: null };
    }
    return { status: 'healthy', message: 'Credentials set' };
  }

  if (platform === 'X') {
    if (!creds.apiKey || !creds.accessToken) return { status: 'unknown', message: 'Not configured' };
    const usage = safeGet('postforge_twitter_usage', {});
    const currentMonth = new Date().toISOString().slice(0, 7);
    const count = usage.month === currentMonth ? (usage.count || 0) : 0;
    const remaining = 1500 - count;
    const pct = Math.round((count / 1500) * 100);

    if (count >= 1500) return { status: 'expired', message: 'Monthly tweet limit reached', usageInfo: { count, limit: 1500, pct: 100 } };
    if (pct >= 80) return { status: 'warning', message: `${count} of 1,500 tweets used — ${remaining} remaining`, usageInfo: { count, limit: 1500, pct } };
    return { status: 'healthy', message: `${count} of 1,500 tweets used`, usageInfo: { count, limit: 1500, pct } };
  }

  if (platform === 'Discord') {
    if (!creds.webhookUrl) return { status: 'unknown', message: 'Not configured' };
    return { status: 'healthy', message: 'Webhook configured' };
  }

  return { status: 'unknown', message: 'Not configured' };
}

/**
 * Record a successful post for tracking.
 */
export function recordSuccess(platform, communityId) {
  const tracker = safeGet('postforge_cred_tracker', {});
  if (platform === 'Reddit') {
    tracker[`reddit_${communityId}_last_success`] = new Date().toISOString();
  }
  tracker[`${platform}_${communityId}_last_test`] = new Date().toISOString();
  tracker[`${platform}_${communityId}_test_ok`] = true;
  safeSet('postforge_cred_tracker', tracker);
}

/**
 * Record a failed connection test.
 */
export function recordTestFailure(platform, communityId) {
  const tracker = safeGet('postforge_cred_tracker', {});
  tracker[`${platform}_${communityId}_last_test`] = new Date().toISOString();
  tracker[`${platform}_${communityId}_test_ok`] = false;
  safeSet('postforge_cred_tracker', tracker);
}

/**
 * Check if a community's credentials need testing (>7 days since last test).
 */
export function needsTest(platform, communityId) {
  const tracker = safeGet('postforge_cred_tracker', {});
  const lastTest = tracker[`${platform}_${communityId}_last_test`];
  if (!lastTest) return true;
  return (Date.now() - new Date(lastTest).getTime()) > 7 * 86400000;
}

/**
 * Get last test result for a community.
 */
export function getLastTestResult(platform, communityId) {
  const tracker = safeGet('postforge_cred_tracker', {});
  return {
    date: tracker[`${platform}_${communityId}_last_test`] || null,
    ok: tracker[`${platform}_${communityId}_test_ok`] ?? null,
  };
}

/**
 * Auto-set token created date when LinkedIn token is saved.
 */
export function onLinkedInTokenSaved(communityId) {
  const communities = safeGet('postforge_communities', []);
  const updated = communities.map(c => {
    if (c.id !== communityId) return c;
    if (c.credentials?.accessToken && !c.credentials?.tokenCreated) {
      return { ...c, credentials: { ...c.credentials, tokenCreated: new Date().toISOString() } };
    }
    return c;
  });
  safeSet('postforge_communities', updated);
}

/**
 * Count communities with expiring/expired credentials.
 */
export function getExpiringCredCount() {
  const communities = safeGet('postforge_communities', []);
  return communities.filter(c => {
    const health = getCredentialHealth(c);
    return health.status === 'expiring' || health.status === 'expired';
  }).length;
}
