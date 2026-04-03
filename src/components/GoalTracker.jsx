import { useState, useEffect } from 'react';
import { Flame, Target, Plus, Trash2, Check } from 'lucide-react';

function getGoals() {
  return JSON.parse(localStorage.getItem('postforge_goals') || '{}');
}
function saveGoals(g) {
  localStorage.setItem('postforge_goals', JSON.stringify(g));
}
function getPostLog() { return JSON.parse(localStorage.getItem('postforge_post_log') || '[]'); }
function getHistory() { return JSON.parse(localStorage.getItem('postforge_history') || '[]'); }
function getCommunities() { return JSON.parse(localStorage.getItem('postforge_communities') || '[]'); }
function toDateKey(iso) { return new Date(iso).toISOString().split('T')[0]; }

function getWeekStart() {
  const n = new Date(); const d = n.getDay();
  const diff = n.getDate() - d + (d === 0 ? -6 : 1);
  const s = new Date(n); s.setDate(diff); s.setHours(0, 0, 0, 0); return s;
}

function calcStreak(allDates) {
  if (allDates.length === 0) return 0;
  const unique = [...new Set(allDates.map(toDateKey))].sort().reverse();
  const today = toDateKey(new Date().toISOString());
  const yesterday = toDateKey(new Date(Date.now() - 86400000).toISOString());
  if (unique[0] !== today && unique[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    if ((new Date(unique[i - 1]) - new Date(unique[i])) / 86400000 === 1) streak++; else break;
  }
  return streak;
}

function ProgressRing({ pct, size = 64, stroke = 5, color = 'var(--accent)' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="goal-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.5s' }} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize="14" fontWeight="700" fill="var(--text)">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function StatusLabel({ pct }) {
  if (pct >= 100) return <span className="goal-status goal-status-crushed"><Flame size={12} /> Crushed it!</span>;
  if (pct >= 60) return <span className="goal-status goal-status-track">On track</span>;
  return <span className="goal-status goal-status-behind">Falling behind</span>;
}

export default function GoalTracker() {
  const [goals, setGoals] = useState(getGoals());
  const [newTask, setNewTask] = useState('');

  const updateGoal = (key, value) => {
    const updated = { ...goals, [key]: value };
    setGoals(updated);
    saveGoals(updated);
  };

  const allEntries = [...getPostLog(), ...getHistory()];
  const allDates = allEntries.map(e => e.date).filter(Boolean);
  const weekStart = getWeekStart();
  const weekEntries = allEntries.filter(e => new Date(e.date) >= weekStart);
  const communities = getCommunities();

  // 1. Weekly Post Goal
  const weeklyGoal = goals.weeklyPostGoal || 7;
  const weekPostCount = weekEntries.length;
  const weekPct = (weekPostCount / weeklyGoal) * 100;

  // 2. Community Coverage
  const coverageGoal = goals.communityCoverageGoal || Math.max(1, communities.length);
  const weekCommunities = [...new Set(weekEntries.map(e => e.community).filter(Boolean))];
  const coveragePct = (weekCommunities.length / coverageGoal) * 100;
  const missedCommunities = communities.filter(c => !weekCommunities.includes(c.name));

  // 3. Streak Goal
  const streakGoal = goals.streakGoal || 7;
  const currentStreak = calcStreak(allDates);
  const streakPct = (currentStreak / streakGoal) * 100;

  // 30-day heatmap
  const heatmap = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = toDateKey(d.toISOString());
    const posted = allDates.some(dt => toDateKey(dt) === key);
    heatmap.push({ key, posted, day: d.getDate(), dow: d.getDay() });
  }

  // 4. Monthly Reach
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthEntries = allEntries.filter(e => new Date(e.date) >= monthStart);
  const commSizes = goals.communitySizes || {};
  let monthReach = 0;
  const commPostCounts = {};
  for (const e of monthEntries) {
    if (e.community) { commPostCounts[e.community] = (commPostCounts[e.community] || 0) + 1; }
  }
  for (const [name, count] of Object.entries(commPostCounts)) {
    monthReach += count * (commSizes[name] || 0);
  }
  const reachGoal = goals.monthlyReachGoal || 1000;
  const reachPct = (monthReach / reachGoal) * 100;

  // 5. Product Launch Goal
  const launchGoal = goals.launchGoal || {};
  const launchDate = launchGoal.date ? new Date(launchGoal.date) : null;
  const launchDaysLeft = launchDate ? Math.max(0, Math.ceil((launchDate - new Date()) / 86400000)) : null;
  const launchTasks = launchGoal.tasks || [];
  const launchDone = launchTasks.filter(t => t.done).length;
  const launchPct = launchTasks.length > 0 ? (launchDone / launchTasks.length) * 100 : 0;

  // All goals hit?
  const allHit = weekPct >= 100 && coveragePct >= 100 && streakPct >= 100;

  // Monday banner
  const isMonday = new Date().getDay() === 1;
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEntries = allEntries.filter(e => { const d = new Date(e.date); return d >= lastWeekStart && d < weekStart; });
  const lastWeekComms = new Set(lastWeekEntries.map(e => e.community).filter(Boolean)).size;

  return (
    <div>
      {/* Monday summary */}
      {isMonday && lastWeekEntries.length > 0 && (
        <div className="goal-monday-banner">
          Last week: <strong>{lastWeekEntries.length} posts</strong> sent to <strong>{lastWeekComms} communities</strong>. This week's goal: <strong>{weeklyGoal} posts</strong>.
        </div>
      )}

      {allHit && (
        <div className="goal-allhit">
          <Flame size={18} /> All weekly goals hit! You're on fire!
        </div>
      )}

      <div className="goal-grid">
        {/* 1. Weekly Post Goal */}
        <div className="goal-card">
          <div className="goal-card-header">
            <div className="goal-card-title">Weekly Posts</div>
            <StatusLabel pct={weekPct} />
          </div>
          <div className="goal-ring-row">
            <ProgressRing pct={weekPct} color={weekPct >= 100 ? 'var(--success)' : 'var(--accent)'} />
            <div>
              <div className="goal-big">{weekPostCount}<span className="goal-of">/ {weeklyGoal}</span></div>
              <input type="range" min="1" max="21" value={weeklyGoal} onChange={e => updateGoal('weeklyPostGoal', Number(e.target.value))} className="goal-slider" />
              <div className="goal-slider-label">{weeklyGoal} posts/week</div>
            </div>
          </div>
        </div>

        {/* 2. Community Coverage */}
        <div className="goal-card">
          <div className="goal-card-header">
            <div className="goal-card-title">Community Coverage</div>
            <StatusLabel pct={coveragePct} />
          </div>
          <div className="goal-big" style={{ marginBottom: 6 }}>{weekCommunities.length}<span className="goal-of">/ {coverageGoal} communities</span></div>
          <div className="goal-bar-wrap"><div className="goal-bar" style={{ width: `${Math.min(100, coveragePct)}%`, background: coveragePct >= 100 ? 'var(--success)' : 'var(--accent)' }} /></div>
          <input type="range" min="1" max={Math.max(communities.length, 1)} value={coverageGoal} onChange={e => updateGoal('communityCoverageGoal', Number(e.target.value))} className="goal-slider" />
          {missedCommunities.length > 0 && (
            <div className="goal-missed">
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Missed this week:</span>
              {missedCommunities.slice(0, 4).map(c => (
                <span key={c.id} className={`platform-badge ${c.platform.toLowerCase()}`} style={{ fontSize: 9 }}>{c.name}</span>
              ))}
              {missedCommunities.length > 4 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{missedCommunities.length - 4}</span>}
            </div>
          )}
        </div>

        {/* 3. Streak Goal + Heatmap */}
        <div className="goal-card goal-card-wide">
          <div className="goal-card-header">
            <div className="goal-card-title">Posting Streak</div>
            <StatusLabel pct={streakPct} />
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div>
              <div className="goal-big">{currentStreak}<span className="goal-of">/ {streakGoal} days</span></div>
              <input type="range" min="1" max="30" value={streakGoal} onChange={e => updateGoal('streakGoal', Number(e.target.value))} className="goal-slider" />
              <div className="goal-bar-wrap" style={{ marginTop: 6 }}>
                <div className="goal-bar" style={{ width: `${Math.min(100, streakPct)}%`, background: streakPct >= 100 ? 'var(--success)' : 'var(--accent)' }} />
              </div>
            </div>
            <div className="goal-heatmap">
              {heatmap.map(d => (
                <div key={d.key} className={`goal-heatmap-cell ${d.posted ? 'goal-hm-active' : ''}`} title={`${d.key}${d.posted ? ' — posted' : ''}`} />
              ))}
            </div>
          </div>
        </div>

        {/* 4. Monthly Reach */}
        <div className="goal-card">
          <div className="goal-card-header">
            <div className="goal-card-title">Monthly Reach</div>
            <StatusLabel pct={reachPct} />
          </div>
          <div className="goal-big">{monthReach.toLocaleString()}<span className="goal-of">/ {reachGoal.toLocaleString()}</span></div>
          <div className="goal-bar-wrap" style={{ marginTop: 6 }}>
            <div className="goal-bar" style={{ width: `${Math.min(100, reachPct)}%`, background: reachPct >= 100 ? 'var(--success)' : 'var(--accent)' }} />
          </div>
          <div className="form-group" style={{ marginTop: 8, maxWidth: 200 }}>
            <label className="form-label">Reach goal</label>
            <input className="form-input" type="number" value={reachGoal} onChange={e => updateGoal('monthlyReachGoal', Number(e.target.value) || 1000)} style={{ padding: '4px 8px', fontSize: 12 }} />
          </div>
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer' }}>Set community sizes</summary>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {communities.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, flex: 1 }}>{c.name}</span>
                  <input className="form-input" type="number" placeholder="0" value={commSizes[c.name] || ''} onChange={e => updateGoal('communitySizes', { ...commSizes, [c.name]: Number(e.target.value) || 0 })} style={{ width: 70, padding: '3px 6px', fontSize: 11 }} />
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* 5. Product Launch Goal */}
        <div className="goal-card">
          <div className="goal-card-header">
            <div className="goal-card-title">Launch Countdown</div>
            {launchTasks.length > 0 && <StatusLabel pct={launchPct} />}
          </div>
          <div className="form-grid" style={{ gap: 8, marginBottom: 10 }}>
            <div className="form-group">
              <label className="form-label">Product</label>
              <input className="form-input" style={{ padding: '4px 8px', fontSize: 12 }} placeholder="Product name..." value={launchGoal.product || ''} onChange={e => updateGoal('launchGoal', { ...launchGoal, product: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Launch Date</label>
              <input className="form-input" style={{ padding: '4px 8px', fontSize: 12 }} type="date" value={launchGoal.date || ''} onChange={e => updateGoal('launchGoal', { ...launchGoal, date: e.target.value })} />
            </div>
          </div>
          {launchDate && (
            <div className="goal-launch-countdown">
              <Target size={14} />
              <strong>{launchDaysLeft}</strong> days until launch
            </div>
          )}
          {launchTasks.length > 0 && (
            <div className="goal-bar-wrap" style={{ marginBottom: 8 }}>
              <div className="goal-bar" style={{ width: `${launchPct}%`, background: launchPct >= 100 ? 'var(--success)' : 'var(--accent)' }} />
            </div>
          )}
          <div className="goal-tasks">
            {launchTasks.map((t, i) => (
              <label key={i} className="goal-task-row">
                <input type="checkbox" checked={t.done} onChange={() => {
                  const tasks = [...launchTasks]; tasks[i] = { ...t, done: !t.done };
                  updateGoal('launchGoal', { ...launchGoal, tasks });
                }} />
                <span className={t.done ? 'goal-task-done' : ''}>{t.text}</span>
                <button className="goal-task-del" onClick={() => {
                  updateGoal('launchGoal', { ...launchGoal, tasks: launchTasks.filter((_, j) => j !== i) });
                }}><Trash2 size={10} /></button>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <input className="form-input" style={{ flex: 1, padding: '4px 8px', fontSize: 12 }} placeholder="Add pre-launch task..." value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => {
              if (e.key === 'Enter' && newTask.trim()) {
                updateGoal('launchGoal', { ...launchGoal, tasks: [...launchTasks, { text: newTask.trim(), done: false }] });
                setNewTask('');
              }
            }} />
            <button className="btn btn-secondary btn-sm" style={{ padding: '3px 8px' }} onClick={() => {
              if (newTask.trim()) {
                updateGoal('launchGoal', { ...launchGoal, tasks: [...launchTasks, { text: newTask.trim(), done: false }] });
                setNewTask('');
              }
            }}><Plus size={12} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
