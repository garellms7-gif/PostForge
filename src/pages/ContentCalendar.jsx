import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { getScheduledPosts, addManualSchedule } from '../lib/scheduler';
import { generatePost, resolveActiveBlocks } from '../lib/generatePost';

function getPostLog() { return JSON.parse(localStorage.getItem('postforge_post_log') || '[]'); }
function getHistory() { return JSON.parse(localStorage.getItem('postforge_history') || '[]'); }
function getCommunities() { return JSON.parse(localStorage.getItem('postforge_communities') || '[]'); }
function getProduct() { const d = localStorage.getItem('postforge_product'); return d ? JSON.parse(d) : {}; }
function getBlocks() { const d = localStorage.getItem('postforge_blocks'); return d ? JSON.parse(d) : null; }
function getQueue() { return JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]'); }
function saveQueue(q) { localStorage.setItem('postforge_approval_queue', JSON.stringify(q)); }

function toDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

const PLATFORM_COLORS = { Discord: '#5865f2', LinkedIn: '#0a66c2', Reddit: '#ff4500', X: '#a0a0a0', Facebook: '#1877f2', Slack: '#e01e5a', Other: '#71717a' };
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getAllPostsForMonth(year, month) {
  const posts = [];
  const scheduled = getScheduledPosts();
  for (const s of scheduled) {
    if (s.time.getFullYear() === year && s.time.getMonth() === month) {
      posts.push({ ...s, type: 'scheduled', dateKey: toDateKey(s.time), hour: s.time.getHours(), minute: s.time.getMinutes() });
    }
  }
  const log = getPostLog();
  for (const l of log) {
    const d = new Date(l.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      posts.push({ community: l.community, platform: l.platform, time: d, type: 'sent', status: l.status, content: l.content, dateKey: toDateKey(d), hour: d.getHours(), minute: d.getMinutes() });
    }
  }
  const hist = getHistory();
  for (const h of hist) {
    const d = new Date(h.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      posts.push({ community: h.community, platform: h.platform, time: d, type: 'history', content: h.content, dateKey: toDateKey(d), hour: d.getHours(), minute: d.getMinutes() });
    }
  }
  return posts;
}

export default function ContentCalendar({ navigateTo }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [dragItem, setDragItem] = useState(null);

  const monthPosts = useMemo(() => getAllPostsForMonth(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); setSelectedDay(null); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); setSelectedDay(null); };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDay(toDateKey(today)); };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const getPostsForDay = (day) => {
    if (!day) return [];
    const key = toDateKey(new Date(viewYear, viewMonth, day));
    return monthPosts.filter(p => p.dateKey === key).sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
  };

  const selectedPosts = selectedDay ? monthPosts.filter(p => p.dateKey === selectedDay).sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute)) : [];

  // Monthly summary
  const daysWithPosts = new Set(monthPosts.map(p => p.dateKey)).size;
  const coverage = daysInMonth > 0 ? Math.round((daysWithPosts / daysInMonth) * 100) : 0;
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const p of monthPosts) { dowCounts[(p.time.getDay() + 6) % 7]++; }
  const busiestDow = DAY_HEADERS[dowCounts.indexOf(Math.max(...dowCounts))];

  // Fill gaps
  const handleFillGaps = () => {
    const communities = getCommunities().filter(c => c.autoPost);
    if (communities.length === 0) return;
    const product = getProduct();
    const blocks = getBlocks();
    const existingDays = new Set(monthPosts.map(p => p.dateKey));
    const queue = getQueue();

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d, 10, 0, 0);
      if (date < today) continue;
      const key = toDateKey(date);
      if (existingDays.has(key)) continue;
      const comm = communities[d % communities.length];
      const activeFlags = blocks ? resolveActiveBlocks(blocks, comm) : {};
      const content = generatePost(product, comm, 'Casual', 'Show & Tell', blocks, activeFlags);
      queue.unshift({ id: Date.now() + Math.random() + d, community: comm.name, communityId: comm.id, platform: comm.platform, content, status: 'pending', date: date.toISOString(), calendarFilled: true });
    }
    saveQueue(queue);
  };

  const handleAddPost = (dateKey) => {
    if (navigateTo) navigateTo('generator', { prefillDate: dateKey });
  };

  const handleDrop = (day) => {
    if (!dragItem || !day) return;
    const newDate = new Date(viewYear, viewMonth, day, dragItem.hour || 10, dragItem.minute || 0);
    // Update in manual schedule
    const manual = JSON.parse(localStorage.getItem('postforge_manual_schedule') || '[]');
    const found = manual.find(m => m.community === dragItem.community && Math.abs(new Date(m.scheduledAt) - dragItem.time) < 60000);
    if (found) {
      found.scheduledAt = newDate.toISOString();
      localStorage.setItem('postforge_manual_schedule', JSON.stringify(manual));
    }
    setDragItem(null);
  };

  const formatTime = (h, m) => {
    const ampm = h >= 12 ? 'pm' : 'am';
    return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2, '0')}${ampm}`;
  };

  const todayKey = toDateKey(today);
  const platforms = [...new Set(getCommunities().map(c => c.platform))];

  return (
    <div>
      <h1 className="page-title">Content Calendar</h1>
      <p className="page-subtitle">Plan and visualize your posting schedule.</p>

      {/* Legend */}
      <div className="cal-legend">
        {platforms.map(p => (
          <div key={p} className="cal-legend-item">
            <div className="cal-dot" style={{ background: PLATFORM_COLORS[p] || PLATFORM_COLORS.Other }} />
            <span>{p}</span>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="cal-nav">
        <button className="btn btn-secondary btn-sm" onClick={prevMonth}><ChevronLeft size={14} /></button>
        <span className="cal-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button className="btn btn-secondary btn-sm" onClick={nextMonth}><ChevronRight size={14} /></button>
        <button className="btn btn-secondary btn-sm" onClick={goToday}>Today</button>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={handleFillGaps}>
          <Sparkles size={13} /> Fill Gaps
        </button>
      </div>

      <div className="cal-layout">
        {/* Calendar grid */}
        <div className="cal-grid-wrap">
          <div className="cal-header">
            {DAY_HEADERS.map(d => <div key={d} className="cal-header-cell">{d}</div>)}
          </div>
          <div className="cal-grid">
            {cells.map((day, i) => {
              const posts = day ? getPostsForDay(day) : [];
              const key = day ? toDateKey(new Date(viewYear, viewMonth, day)) : null;
              const isToday = key === todayKey;
              const isSelected = key === selectedDay;
              const uniquePlatforms = [...new Set(posts.map(p => p.platform))];
              return (
                <div
                  key={i}
                  className={`cal-cell ${!day ? 'cal-cell-empty' : ''} ${isToday ? 'cal-cell-today' : ''} ${isSelected ? 'cal-cell-selected' : ''}`}
                  onClick={() => day && setSelectedDay(key)}
                  onDragOver={e => { if (day) e.preventDefault(); }}
                  onDrop={() => handleDrop(day)}
                >
                  {day && (
                    <>
                      <div className="cal-day-num">{day}</div>
                      {posts.length > 0 && (
                        <>
                          <div className="cal-dots">
                            {uniquePlatforms.slice(0, 4).map(p => (
                              <div key={p} className="cal-dot" style={{ background: PLATFORM_COLORS[p] || PLATFORM_COLORS.Other }} />
                            ))}
                          </div>
                          <div className="cal-count">{posts.length}</div>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        {selectedDay && (
          <div className="cal-detail">
            <div className="cal-detail-header">
              <span className="cal-detail-date">{new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{selectedPosts.length} post{selectedPosts.length !== 1 ? 's' : ''}</span>
            </div>
            {selectedPosts.length > 0 ? (
              <div className="cal-detail-list">
                {selectedPosts.map((p, i) => (
                  <div
                    key={i}
                    className="cal-detail-item"
                    draggable
                    onDragStart={() => setDragItem(p)}
                  >
                    <div className="cal-detail-time">{formatTime(p.hour, p.minute)}</div>
                    <span className={`platform-badge ${(p.platform || '').toLowerCase()}`}>{p.platform}</span>
                    <span className="cal-detail-comm">{p.community}</span>
                    {p.type === 'sent' && <span className={`pq-status ${p.status === 'success' ? 'pq-status-sent' : 'pq-status-failed'}`}>{p.status === 'success' ? 'Sent' : 'Failed'}</span>}
                    {p.content && <div className="cal-detail-preview">{(p.content || '').slice(0, 60)}...</div>}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--muted)', padding: 12 }}>No posts this day.</p>
            )}
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10, width: '100%' }} onClick={() => handleAddPost(selectedDay)}>
              <Plus size={13} /> Add Post
            </button>
          </div>
        )}
      </div>

      {/* Monthly Summary */}
      <div className="cal-summary">
        <div className="cal-summary-stat"><strong>{monthPosts.length}</strong> posts this month</div>
        <div className="cal-summary-stat"><strong>{daysWithPosts}</strong>/{daysInMonth} days covered ({coverage}%)</div>
        <div className="cal-summary-stat">Busiest day: <strong>{busiestDow}</strong></div>
      </div>
    </div>
  );
}
