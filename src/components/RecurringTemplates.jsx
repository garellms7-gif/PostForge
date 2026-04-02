import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit3, Play, Clock, ChevronDown, ChevronUp, Power } from 'lucide-react';
import { generatePost, resolveActiveBlocks } from '../lib/generatePost';
import { postToPlatform } from '../lib/posting';

function getTemplates() {
  return JSON.parse(localStorage.getItem('postforge_templates') || '[]');
}

function saveTemplates(t) {
  localStorage.setItem('postforge_templates', JSON.stringify(t));
}

function getCommunities() {
  return JSON.parse(localStorage.getItem('postforge_communities') || '[]');
}

function getProduct() {
  const d = localStorage.getItem('postforge_product');
  return d ? JSON.parse(d) : {};
}

function getBlocks() {
  const d = localStorage.getItem('postforge_blocks');
  return d ? JSON.parse(d) : null;
}

function addLogEntry(entry) {
  const log = JSON.parse(localStorage.getItem('postforge_post_log') || '[]');
  log.unshift(entry);
  localStorage.setItem('postforge_post_log', JSON.stringify(log.slice(0, 200)));
}

const POST_TYPES = ['Launch Announcement', 'Feature Update', 'Ask for Feedback', 'Show & Tell', 'Milestone', 'Tips & Value'];
const RECURRENCE_OPTIONS = ['Daily', 'Weekly', 'Monthly', 'Custom'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getNextRun(template) {
  const now = new Date();
  const time = template.runTime || '10:00';
  const [h, m] = time.split(':').map(Number);

  if (template.recurrence === 'Daily') {
    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }
  if (template.recurrence === 'Weekly') {
    const targetDay = template.weekDay || 1;
    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    let daysUntil = (targetDay - now.getDay() + 7) % 7;
    if (daysUntil === 0 && next <= now) daysUntil = 7;
    next.setDate(next.getDate() + daysUntil);
    return next;
  }
  if (template.recurrence === 'Monthly') {
    const targetDate = template.monthDate || 1;
    const next = new Date(now.getFullYear(), now.getMonth(), targetDate, h, m, 0);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return next;
  }
  if (template.recurrence === 'Custom') {
    const interval = template.customDays || 3;
    const lastRun = template.lastRun ? new Date(template.lastRun) : new Date(now.getTime() - interval * 86400000);
    const next = new Date(lastRun.getTime() + interval * 86400000);
    next.setHours(h, m, 0, 0);
    if (next <= now) {
      const next2 = new Date(now);
      next2.setHours(h, m, 0, 0);
      if (next2 <= now) next2.setDate(next2.getDate() + 1);
      return next2;
    }
    return next;
  }
  return new Date(now.getTime() + 86400000);
}

function formatCountdown(target) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return 'Now';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSchedule(t) {
  if (t.recurrence === 'Daily') return `Daily at ${t.runTime || '10:00'}`;
  if (t.recurrence === 'Weekly') return `Every ${DAY_NAMES[t.weekDay || 1]} at ${t.runTime || '10:00'}`;
  if (t.recurrence === 'Monthly') return `Monthly on the ${t.monthDate || 1}${['st','nd','rd'][((t.monthDate||1)-1)%10] || 'th'} at ${t.runTime || '10:00'}`;
  if (t.recurrence === 'Custom') return `Every ${t.customDays || 3} days at ${t.runTime || '10:00'}`;
  return t.recurrence;
}

const EMPTY_TEMPLATE = {
  name: '', communityIds: [], postType: 'Show & Tell', recurrence: 'Weekly', weekDay: 1, monthDate: 1, customDays: 3, runTime: '10:00', promptContext: '', active: true,
};

export default function RecurringTemplates() {
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_TEMPLATE });
  const [communities] = useState(getCommunities());
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [running, setRunning] = useState(null);
  const [, setTick] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    setTemplates(getTemplates());
    // Tick for countdowns
    const i = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(i);
  }, []);

  // Auto-run timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const active = templates.filter(t => t.active);
    if (active.length === 0) return;

    timerRef.current = setInterval(() => {
      const now = new Date();
      const current = getTemplates();
      let changed = false;
      for (const t of current) {
        if (!t.active) continue;
        const next = getNextRun(t);
        if (now >= next && (!t.lastRun || new Date(t.lastRun).getTime() < next.getTime() - 60000)) {
          runTemplate(t);
          t.lastRun = now.toISOString();
          changed = true;
        }
      }
      if (changed) {
        saveTemplates(current);
        setTemplates([...current]);
      }
    }, 10000);

    return () => clearInterval(timerRef.current);
  }, [templates]);

  const runTemplate = async (template) => {
    setRunning(template.id);
    const product = getProduct();
    const blocks = getBlocks();
    const allComms = getCommunities();
    const targetComms = template.communityIds.length > 0
      ? allComms.filter(c => template.communityIds.includes(c.id))
      : allComms.filter(c => c.autoPost);

    const generatedPosts = [];

    for (const community of targetComms) {
      const activeFlags = blocks ? resolveActiveBlocks(blocks, community) : {};
      const contextProduct = { ...product, description: template.promptContext ? `${template.promptContext}. ${product.description || ''}` : product.description };
      const content = generatePost(contextProduct, community, 'Casual', template.postType, blocks, activeFlags);

      let status = 'success';
      let error = '';
      try {
        await postToPlatform(community, content);
      } catch (err) {
        status = 'failed';
        error = err.message;
      }

      addLogEntry({
        id: Date.now() + Math.random(),
        community: community.name,
        platform: community.platform,
        content: content.slice(0, 120) + (content.length > 120 ? '...' : ''),
        status, error,
        templateName: template.name,
        date: new Date().toISOString(),
      });

      generatedPosts.push({ content: content.slice(0, 200), community: community.name, date: new Date().toISOString(), status });
    }

    // Save to template history
    const updated = getTemplates().map(t => {
      if (t.id !== template.id) return t;
      const history = [{ posts: generatedPosts, date: new Date().toISOString() }, ...(t.history || [])].slice(0, 10);
      return { ...t, lastRun: new Date().toISOString(), history };
    });
    saveTemplates(updated);
    setTemplates(updated);
    setRunning(null);
  };

  const handleSave = () => {
    let updated;
    if (editId) {
      updated = templates.map(t => t.id === editId ? { ...t, ...form } : t);
    } else {
      updated = [...templates, { ...form, id: Date.now(), history: [], lastRun: null }];
    }
    saveTemplates(updated);
    setTemplates(updated);
    setForm({ ...EMPTY_TEMPLATE });
    setShowForm(false);
    setEditId(null);
  };

  const handleEdit = (t) => {
    setForm({ name: t.name, communityIds: t.communityIds || [], postType: t.postType, recurrence: t.recurrence, weekDay: t.weekDay || 1, monthDate: t.monthDate || 1, customDays: t.customDays || 3, runTime: t.runTime || '10:00', promptContext: t.promptContext || '', active: t.active });
    setEditId(t.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    const updated = templates.filter(t => t.id !== id);
    saveTemplates(updated);
    setTemplates(updated);
  };

  const handleToggleActive = (id) => {
    const updated = templates.map(t => t.id === id ? { ...t, active: !t.active } : t);
    saveTemplates(updated);
    setTemplates(updated);
  };

  const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const toggleCommunity = (id) => {
    const ids = form.communityIds.includes(id) ? form.communityIds.filter(i => i !== id) : [...form.communityIds, id];
    updateForm('communityIds', ids);
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>Recurring Templates</div>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Post blueprints that auto-generate on a set schedule.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm({ ...EMPTY_TEMPLATE }); setEditId(null); setShowForm(!showForm); }}>
            <Plus size={14} /> {showForm ? 'Cancel' : 'Add Template'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="rt-form">
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Template Name</label>
                <input className="form-input" placeholder='e.g. "Weekly Progress Update"' value={form.name} onChange={e => updateForm('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Post Type</label>
                <select className="form-select" value={form.postType} onChange={e => updateForm('postType', e.target.value)}>
                  {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Recurrence</label>
                <select className="form-select" value={form.recurrence} onChange={e => updateForm('recurrence', e.target.value)}>
                  {RECURRENCE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.recurrence === 'Weekly' && (
                <div className="form-group">
                  <label className="form-label">Day of Week</label>
                  <select className="form-select" value={form.weekDay} onChange={e => updateForm('weekDay', Number(e.target.value))}>
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              {form.recurrence === 'Monthly' && (
                <div className="form-group">
                  <label className="form-label">Day of Month</label>
                  <input className="form-input" type="number" min="1" max="28" value={form.monthDate} onChange={e => updateForm('monthDate', Number(e.target.value))} />
                </div>
              )}
              {form.recurrence === 'Custom' && (
                <div className="form-group">
                  <label className="form-label">Every X days</label>
                  <input className="form-input" type="number" min="1" max="365" value={form.customDays} onChange={e => updateForm('customDays', Number(e.target.value))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Run Time</label>
                <input className="form-input" type="time" value={form.runTime} onChange={e => updateForm('runTime', e.target.value)} />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Communities</label>
                <div className="rt-comm-chips">
                  {communities.map(c => (
                    <button key={c.id} className={`rt-comm-chip ${form.communityIds.includes(c.id) ? 'rt-comm-active' : ''}`} onClick={() => toggleCommunity(c.id)}>
                      <span className={`platform-badge ${c.platform.toLowerCase()}`} style={{ marginRight: 4 }}>{c.platform}</span>
                      {c.name}
                    </button>
                  ))}
                  {communities.length === 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>No communities — add some first</span>}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Leave empty to post to all auto-post communities</span>
              </div>
              <div className="form-group full-width">
                <label className="form-label">Prompt Context</label>
                <textarea className="form-textarea" placeholder="What should this post always include? E.g. latest user count, current version, progress on roadmap" value={form.promptContext} onChange={e => updateForm('promptContext', e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.name.trim()}>
                {editId ? 'Update Template' : 'Save Template'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Template cards */}
      {templates.length > 0 && (
        <div className="rt-cards">
          {templates.map(t => {
            const nextRun = getNextRun(t);
            const isExpanded = expandedHistory === t.id;
            const recentHistory = (t.history || []).slice(0, 3);
            return (
              <div key={t.id} className={`rt-card ${!t.active ? 'rt-card-inactive' : ''}`}>
                <div className="rt-card-header">
                  <div>
                    <div className="rt-card-name">{t.name}</div>
                    <div className="rt-card-schedule">{formatSchedule(t)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {t.active && (
                      <span className="rt-next-run">
                        <Clock size={11} /> {formatCountdown(nextRun)}
                      </span>
                    )}
                    <div className="toggle-wrapper" onClick={() => handleToggleActive(t.id)} style={{ marginLeft: 0 }}>
                      <div className={`toggle ${t.active ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
                    </div>
                  </div>
                </div>

                {t.promptContext && (
                  <div className="rt-card-context">{t.promptContext.slice(0, 80)}{t.promptContext.length > 80 ? '...' : ''}</div>
                )}

                <div className="rt-card-comms">
                  {(t.communityIds || []).length > 0
                    ? communities.filter(c => t.communityIds.includes(c.id)).map(c => (
                      <span key={c.id} className={`platform-badge ${c.platform.toLowerCase()}`}>{c.name}</span>
                    ))
                    : <span style={{ fontSize: 11, color: 'var(--muted)' }}>All auto-post communities</span>
                  }
                </div>

                <div className="rt-card-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => runTemplate(t)} disabled={running === t.id}>
                    {running === t.id ? <span className="spinner" /> : <Play size={13} />}
                    {running === t.id ? 'Running...' : 'Run Now'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(t)}><Edit3 size={13} /> Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}><Trash2 size={13} /></button>
                  {recentHistory.length > 0 && (
                    <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setExpandedHistory(isExpanded ? null : t.id)}>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      History ({(t.history || []).length})
                    </button>
                  )}
                </div>

                {isExpanded && recentHistory.length > 0 && (
                  <div className="rt-history">
                    {recentHistory.map((h, i) => (
                      <div key={i} className="rt-history-entry">
                        <div className="rt-history-date">{new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        {h.posts.map((p, j) => (
                          <div key={j} className="rt-history-post">
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.community}</span>
                            <span className={`pq-status ${p.status === 'success' ? 'pq-status-sent' : 'pq-status-failed'}`}>{p.status}</span>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.content.slice(0, 80)}...</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
