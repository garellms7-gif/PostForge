/**
 * Smart Schedule Optimizer for PostForge.
 */
import { safeGet, safeSet, safeSetRaw, safeGetRaw, safeRemove } from './safeStorage';

const PEAK_WINDOWS = {
  Discord: [
    { days: [1, 2, 3, 4, 5], start: 19, end: 22, label: 'Weekdays 7pm-10pm' },
    { days: [0, 6], start: 12, end: 15, label: 'Weekends 12pm-3pm' },
  ],
  LinkedIn: [
    { days: [2, 3, 4], start: 8, end: 10, label: 'Tue-Thu 8am-10am' },
    { days: [2, 3, 4], start: 17, end: 18, label: 'Tue-Thu 5pm-6pm' },
  ],
  Reddit: [
    { days: [1, 2, 3, 4, 5], start: 8, end: 11, label: 'Weekdays 8am-11am' },
    { days: [1, 2, 3, 4, 5], start: 17, end: 20, label: 'Weekdays 5pm-8pm' },
  ],
  X: [
    { days: [1, 2, 3, 4, 5], start: 8, end: 10, label: 'Weekdays 8am-10am' },
    { days: [1, 2, 3, 4, 5], start: 18, end: 21, label: 'Weekdays 6pm-9pm' },
  ],
};

export function getPeakWindows(platform) {
  return PEAK_WINDOWS[platform] || PEAK_WINDOWS.Reddit;
}

export function isInPeakWindow(platform, dayOfWeek, hour) {
  const windows = getPeakWindows(platform);
  return windows.some(w => w.days.includes(dayOfWeek) && hour >= w.start && hour < w.end);
}

/**
 * Get scheduled posts for the next 7 days.
 * Combines launch schedule, product schedules, and manual scheduled posts.
 */
export function getScheduledPosts() {
  const posts = [];

  // From launch schedule
  const launch = safeGet('postforge_launch_schedule', []);
  for (const item of launch) {
    if (item.status === 'pending') {
      posts.push({
        community: item.community,
        platform: item.platform,
        time: new Date(item.scheduledAt),
        source: 'launch',
      });
    }
  }

  // From activated products (daily scheduled)
  const products = safeGet('postforge_products', []);
  const communities = safeGet('postforge_communities', []);
  const activatedProducts = products.filter(p => p.activated);
  const autoPostCommunities = communities.filter(c => c.autoPost);

  for (const prod of activatedProducts) {
    const [h, m] = (prod.scheduleTime || '10:00').split(':').map(Number);
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      date.setHours(h, m, 0, 0);
      if (date.getTime() > Date.now()) {
        for (const comm of autoPostCommunities) {
          posts.push({
            community: comm.name,
            platform: comm.platform,
            time: date,
            source: 'product',
            productName: prod.name,
          });
        }
      }
    }
  }

  // Manual scheduled posts from postforge_manual_schedule
  const manual = safeGet('postforge_manual_schedule', []);
  for (const item of manual) {
    posts.push({
      community: item.community,
      platform: item.platform,
      time: new Date(item.scheduledAt),
      source: 'manual',
    });
  }

  return posts;
}

/**
 * Detect conflicts: posts to same platform within 2 hours.
 */
export function detectConflicts(posts) {
  const conflicts = [];
  const sorted = [...posts].sort((a, b) => a.time - b.time);

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const diffMs = b.time.getTime() - a.time.getTime();
      if (diffMs > 2 * 3600000) break;
      if (a.platform === b.platform) {
        conflicts.push({
          postA: a,
          postB: b,
          gap: Math.round(diffMs / 60000),
        });
      }
    }
  }
  return conflicts;
}

/**
 * Save a manually scheduled post.
 */
export function addManualSchedule(community, platform, scheduledAt) {
  const manual = safeGet('postforge_manual_schedule', []);
  manual.push({ id: Date.now(), community, platform, scheduledAt });
  safeSet('postforge_manual_schedule', manual);
}

export function getTimezone() {
  const settings = safeGet('postforge_settings', {});
  return settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}
