import { useState, useMemo } from 'react';
import { Clock, AlertTriangle, ExternalLink, Plus } from 'lucide-react';
import { getPeakWindows, isInPeakWindow, getScheduledPosts, detectConflicts, addManualSchedule, getTimezone } from '../lib/scheduler';

function getCommunities() {
  return JSON.parse(localStorage.getItem('postforge_communities') || '[]');
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am to 11pm

export default function OptimalTiming() {
  const [scheduleSlot, setScheduleSlot] = useState(null);
  const communities = getCommunities();
  const platforms = [...new Set(communities.map(c => c.platform))].filter(p => ['Discord', 'LinkedIn', 'Reddit', 'X'].includes(p));
  const tz = getTimezone();

  const scheduledPosts = useMemo(() => getScheduledPosts(), []);
  const conflicts = useMemo(() => detectConflicts(scheduledPosts), [scheduledPosts]);

  // Build 7-day grid
  const days = useMemo(() => {
    const result = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      result.push(date);
    }
    return result;
  }, []);

  const handleSlotClick = (day, hour) => {
    if (communities.length === 0) return;
    setScheduleSlot({ day, hour });
  };

  const handleSchedulePost = (communityId) => {
    if (!scheduleSlot) return;
    const comm = communities.find(c => c.id === communityId);
    if (!comm) return;
    const date = new Date(scheduleSlot.day);
    date.setHours(scheduleSlot.hour, 0, 0, 0);
    addManualSchedule(comm.name, comm.platform, date.toISOString());
    setScheduleSlot(null);
  };

  const formatHour = (h) => {
    if (h === 0 || h === 12) return `${h === 0 ? 12 : 12}${h < 12 ? 'am' : 'pm'}`;
    return `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`;
  };

  const getPostsForSlot = (day, hour) => {
    return scheduledPosts.filter(p => {
      const d = p.time;
      return d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate() &&
        d.getHours() === hour;
    });
  };

  // Determine if slot is a peak window for any community platform
  const isGoodSlot = (day, hour) => {
    return platforms.some(p => isInPeakWindow(p, day.getDay(), hour));
  };

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={16} />
        Optimal Timing
      </div>

      {/* Best Time Suggester */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Peak Engagement Windows</div>
        <div className="ot-peak-grid">
          {platforms.map(p => (
            <div key={p} className="ot-peak-card">
              <div className="ot-peak-platform">
                <span className={`platform-badge ${p.toLowerCase()}`}>{p}</span>
              </div>
              <div className="ot-peak-windows">
                {getPeakWindows(p).map((w, i) => (
                  <div key={i} className="ot-peak-window">{w.label}</div>
                ))}
              </div>
              {p === 'Reddit' && (() => {
                const redditComms = communities.filter(c => c.platform === 'Reddit');
                return redditComms.map(rc => {
                  const sub = rc.credentials?.subreddit;
                  return sub ? (
                    <a
                      key={rc.id}
                      href={`https://www.reddit.com/r/${sub}/about`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ot-research-btn"
                    >
                      <ExternalLink size={11} /> Research r/{sub}
                    </a>
                  ) : null;
                });
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* Conflict Detector */}
      {conflicts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {conflicts.map((c, i) => (
            <div key={i} className="ot-conflict">
              <AlertTriangle size={14} />
              Posts to {c.postA.platform} too close together ({c.gap}min apart): "{c.postA.community}" and "{c.postB.community}" — may reduce reach
            </div>
          ))}
        </div>
      )}

      {/* 7-day Calendar Grid */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        7-Day Schedule
        <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
          {tz} · Green slots = peak engagement
        </span>
      </div>
      <div className="ot-calendar">
        {/* Header row */}
        <div className="ot-cal-header">
          <div className="ot-cal-hour-label" />
          {days.map((d, i) => (
            <div key={i} className="ot-cal-day-label">
              {DAY_LABELS[d.getDay()]} {d.getDate()}
            </div>
          ))}
        </div>
        {/* Hour rows */}
        <div className="ot-cal-body">
          {HOURS.map(hour => (
            <div key={hour} className="ot-cal-row">
              <div className="ot-cal-hour-label">{formatHour(hour)}</div>
              {days.map((day, di) => {
                const posts = getPostsForSlot(day, hour);
                const isPeak = isGoodSlot(day, hour);
                const isPast = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour) < new Date();
                const isSelected = scheduleSlot && scheduleSlot.day.getDate() === day.getDate() && scheduleSlot.hour === hour;

                return (
                  <div
                    key={di}
                    className={`ot-cal-cell ${posts.length > 0 ? 'ot-cal-has-post' : ''} ${isPeak && posts.length === 0 && !isPast ? 'ot-cal-peak' : ''} ${isPast ? 'ot-cal-past' : ''} ${isSelected ? 'ot-cal-selected' : ''}`}
                    onClick={() => !isPast && posts.length === 0 && isPeak && handleSlotClick(day, hour)}
                    title={isPeak ? 'Peak engagement window — click to schedule' : ''}
                  >
                    {posts.length > 0 ? (
                      <div className="ot-cal-post-dot" title={posts.map(p => p.community).join(', ')}>
                        {posts.length}
                      </div>
                    ) : (isPeak && !isPast ? (
                      <Plus size={10} className="ot-cal-plus" />
                    ) : null)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Schedule Slot Picker */}
      {scheduleSlot && (
        <div className="ot-slot-picker">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Schedule post for {DAY_LABELS[scheduleSlot.day.getDay()]} {scheduleSlot.day.getDate()} at {formatHour(scheduleSlot.hour)}
          </div>
          <div className="ot-slot-communities">
            {communities.map(c => (
              <button key={c.id} className="btn btn-secondary btn-sm" onClick={() => handleSchedulePost(c.id)}>
                <span className={`platform-badge ${c.platform.toLowerCase()}`} style={{ marginRight: 4 }}>{c.platform}</span>
                {c.name}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setScheduleSlot(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
