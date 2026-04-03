import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Play, Power, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { generatePost, resolveActiveBlocks } from '../lib/generatePost';

function getRules() { return JSON.parse(localStorage.getItem('postforge_rules') || '[]'); }
function saveRules(r) { localStorage.setItem('postforge_rules', JSON.stringify(r)); }
function getRulesLog() { return JSON.parse(localStorage.getItem('postforge_rules_log') || '[]'); }
function addRulesLog(entry) {
  const log = getRulesLog();
  log.unshift({ ...entry, id: Date.now() + Math.random(), date: new Date().toISOString() });
  localStorage.setItem('postforge_rules_log', JSON.stringify(log.slice(0, 50)));
}
function getCommunities() { return JSON.parse(localStorage.getItem('postforge_communities') || '[]'); }
function getProduct() { const d = localStorage.getItem('postforge_product'); return d ? JSON.parse(d) : {}; }
function getBlocks() { const d = localStorage.getItem('postforge_blocks'); return d ? JSON.parse(d) : null; }
function getQueue() { return JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]'); }
function saveQueue(q) { localStorage.setItem('postforge_approval_queue', JSON.stringify(q)); }

const TRIGGERS = [
  { id: 'day_time', label: 'Day of week + time', fields: ['day', 'time'] },
  { id: 'time_only', label: 'Every day at time', fields: ['time'] },
  { id: 'inactivity', label: 'X days since last post to community', fields: ['days', 'community'] },
  { id: 'streak', label: 'Streak reaches X days', fields: ['days'] },
  { id: 'high_performer', label: 'Post marked as high performer', fields: [] },
  { id: 'new_version', label: 'New product version saved', fields: [] },
];

const ACTIONS = [
  { id: 'queue_post', label: 'Generate and queue a post', fields: ['community'] },
  { id: 'send_post', label: 'Send a post immediately', fields: ['community'] },
  { id: 'notify', label: 'Send a browser notification', fields: ['message'] },
  { id: 'enable_product', label: 'Enable a product', fields: [] },
  { id: 'pause_all', label: 'Pause all posting', fields: [] },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TEMPLATES = [
  { name: 'Weekly Monday update', trigger: { type: 'day_time', day: 1, time: '09:00' }, action: { type: 'queue_post', community: '_all' }, description: 'Every Monday at 9am → Generate weekly update post for all active communities' },
  { name: 'Re-engagement after 10 days', trigger: { type: 'inactivity', days: 10, community: '_any' }, action: { type: 'queue_post', community: '_all' }, description: 'When 10 days since last post to any community → Generate re-engagement post' },
  { name: 'Launch on new version', trigger: { type: 'new_version' }, action: { type: 'queue_post', community: '_all' }, description: 'When new product version saved → Generate launch announcement for all communities' },
  { name: 'Friday engagement post', trigger: { type: 'day_time', day: 5, time: '16:00' }, action: { type: 'queue_post', community: '_all' }, description: 'Every Friday at 4pm → Generate weekend engagement post' },
];

const EMPTY_RULE = { name: '', trigger: { type: 'day_time', day: 1, time: '10:00', days: 7, community: '_all' }, action: { type: 'queue_post', community: '_all', message: '' }, active: true };

function executeAction(rule) {
  const communities = getCommunities();
  const product = getProduct();
  const blocks = getBlocks();
  const actionComm = rule.action.community;
  const targets = actionComm === '_all' ? communities.filter(c => c.autoPost) : communities.filter(c => String(c.id) === String(actionComm));

  if (rule.action.type === 'queue_post' || rule.action.type === 'send_post') {
    const queue = getQueue();
    for (const comm of targets) {
      const activeFlags = blocks ? resolveActiveBlocks(blocks, comm) : {};
      const content = generatePost(product, comm, 'Casual', 'Show & Tell', blocks, activeFlags);
      queue.unshift({ id: Date.now() + Math.random(), community: comm.name, communityId: comm.id, platform: comm.platform, content, status: rule.action.type === 'send_post' ? 'approved' : 'pending', date: new Date().toISOString(), ruleGenerated: true });
    }
    saveQueue(queue);
    addRulesLog({ rule: rule.name, action: `Generated ${targets.length} post(s)`, type: rule.action.type });
  } else if (rule.action.type === 'notify') {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('PostForge Rule', { body: rule.action.message || rule.name });
    } else if ('Notification' in window) {
      Notification.requestPermission();
    }
    addRulesLog({ rule: rule.name, action: 'Notification sent', type: 'notify' });
  } else if (rule.action.type === 'pause_all') {
    localStorage.setItem('postforge_queue_paused', 'true');
    addRulesLog({ rule: rule.name, action: 'All posting paused', type: 'pause_all' });
  } else {
    addRulesLog({ rule: rule.name, action: rule.action.type, type: rule.action.type });
  }
}

export default function RulesEngine() {
  const [rules, setRules] = useState([]);
  const [rulesLog, setRulesLog] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_RULE });
  const [communities] = useState(getCommunities());
  const [showTemplates, setShowTemplates] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setRules(getRules());
    setRulesLog(getRulesLog());
  }, []);

  // Rule evaluation timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const active = rules.filter(r => r.active);
    if (active.length === 0) return;

    timerRef.current = setInterval(() => {
      const now = new Date();
      const current = getRules();
      let changed = false;

      for (const rule of current) {
        if (!rule.active) continue;
        const t = rule.trigger;
        let shouldFire = false;

        if (t.type === 'day_time') {
          const [h, m] = (t.time || '10:00').split(':').map(Number);
          if (now.getDay() === (t.day || 0) && now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 15) shouldFire = true;
        } else if (t.type === 'time_only') {
          const [h, m] = (t.time || '10:00').split(':').map(Number);
          if (now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 15) shouldFire = true;
        } else if (t.type === 'inactivity') {
          const lastDates = JSON.parse(localStorage.getItem('postforge_last_post_dates') || '{}');
          const comms = t.community === '_any' ? getCommunities() : getCommunities().filter(c => String(c.id) === String(t.community));
          for (const c of comms) {
            const last = lastDates[c.name];
            if (last && (Date.now() - new Date(last).getTime()) > (t.days || 7) * 86400000) {
              shouldFire = true; break;
            }
          }
        } else if (t.type === 'streak') {
          const log = JSON.parse(localStorage.getItem('postforge_post_log') || '[]');
          const history = JSON.parse(localStorage.getItem('postforge_history') || '[]');
          const dates = [...log, ...history].map(e => e.date).filter(Boolean);
          const unique = [...new Set(dates.map(d => new Date(d).toISOString().split('T')[0]))].sort().reverse();
          let streak = 0;
          const today = new Date().toISOString().split('T')[0];
          if (unique[0] === today || unique[0] === new Date(Date.now() - 86400000).toISOString().split('T')[0]) {
            streak = 1;
            for (let i = 1; i < unique.length; i++) {
              if ((new Date(unique[i - 1]) - new Date(unique[i])) / 86400000 === 1) streak++; else break;
            }
          }
          if (streak >= (t.days || 7)) shouldFire = true;
        }

        // Debounce: don't fire more than once per hour
        if (shouldFire) {
          const lastFired = rule.lastFired ? new Date(rule.lastFired).getTime() : 0;
          if (Date.now() - lastFired > 3600000) {
            executeAction(rule);
            rule.lastFired = new Date().toISOString();
            changed = true;
          }
        }
      }

      if (changed) {
        saveRules(current);
        setRules([...current]);
        setRulesLog(getRulesLog());
      }
    }, 10000);

    return () => clearInterval(timerRef.current);
  }, [rules]);

  const handleSave = () => {
    let updated;
    if (editId) {
      updated = rules.map(r => r.id === editId ? { ...r, ...form } : r);
    } else {
      updated = [...rules, { ...form, id: Date.now(), lastFired: null }];
    }
    saveRules(updated); setRules(updated);
    setForm({ ...EMPTY_RULE }); setShowForm(false); setEditId(null);
  };

  const handleEdit = (r) => {
    setForm({ name: r.name, trigger: { ...r.trigger }, action: { ...r.action }, active: r.active });
    setEditId(r.id); setShowForm(true);
  };

  const handleDelete = (id) => {
    const updated = rules.filter(r => r.id !== id);
    saveRules(updated); setRules(updated);
  };

  const handleToggle = (id) => {
    const updated = rules.map(r => r.id === id ? { ...r, active: !r.active } : r);
    saveRules(updated); setRules(updated);
  };

  const handleRunNow = (rule) => {
    executeAction(rule);
    const updated = getRules().map(r => r.id === rule.id ? { ...r, lastFired: new Date().toISOString() } : r);
    saveRules(updated); setRules(updated); setRulesLog(getRulesLog());
  };

  const handleLoadTemplate = (t) => {
    const rule = { ...EMPTY_RULE, name: t.name, trigger: { ...EMPTY_RULE.trigger, ...t.trigger }, action: { ...EMPTY_RULE.action, ...t.action }, id: Date.now(), lastFired: null };
    const updated = [...rules, rule];
    saveRules(updated); setRules(updated);
  };

  const updateTrigger = (k, v) => setForm(f => ({ ...f, trigger: { ...f.trigger, [k]: v } }));
  const updateAction = (k, v) => setForm(f => ({ ...f, action: { ...f.action, [k]: v } }));
  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

  const describeTrigger = (t) => {
    if (t.type === 'day_time') return `Every ${DAY_NAMES[t.day || 0]} at ${t.time || '10:00'}`;
    if (t.type === 'time_only') return `Every day at ${t.time || '10:00'}`;
    if (t.type === 'inactivity') return `${t.days || 7} days since last post`;
    if (t.type === 'streak') return `Streak reaches ${t.days || 7} days`;
    if (t.type === 'high_performer') return 'Post marked as high performer';
    if (t.type === 'new_version') return 'New product version saved';
    return t.type;
  };

  return (
    <div>
      {/* Templates */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>Automation Rules</div>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>If/then triggers that automate your posting workflow.</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowTemplates(!showTemplates)}>
              {showTemplates ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Templates
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => { setForm({ ...EMPTY_RULE }); setEditId(null); setShowForm(!showForm); }}>
              <Plus size={14} /> {showForm ? 'Cancel' : 'Add Rule'}
            </button>
          </div>
        </div>

        {showTemplates && (
          <div className="re-templates">
            {TEMPLATES.map((t, i) => (
              <div key={i} className="re-template-card">
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.description}</div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={() => handleLoadTemplate(t)}>
                  <Zap size={12} /> Activate
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Rule Builder Form */}
        {showForm && (
          <div className="re-form">
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Rule Name</label>
              <input className="form-input" placeholder='e.g. "Monday weekly update"' value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="re-form-sections">
              <div className="re-form-section">
                <div className="re-section-label">IF</div>
                <select className="form-select" value={form.trigger.type} onChange={e => updateTrigger('type', e.target.value)} style={{ marginBottom: 8 }}>
                  {TRIGGERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                {(form.trigger.type === 'day_time') && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="form-select" value={form.trigger.day || 0} onChange={e => updateTrigger('day', Number(e.target.value))}>
                      {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                    <input className="form-input" type="time" value={form.trigger.time || '10:00'} onChange={e => updateTrigger('time', e.target.value)} />
                  </div>
                )}
                {form.trigger.type === 'time_only' && (
                  <input className="form-input" type="time" value={form.trigger.time || '10:00'} onChange={e => updateTrigger('time', e.target.value)} />
                )}
                {(form.trigger.type === 'inactivity' || form.trigger.type === 'streak') && (
                  <input className="form-input" type="number" min="1" max="90" placeholder="Days" value={form.trigger.days || 7} onChange={e => updateTrigger('days', Number(e.target.value))} />
                )}
                {form.trigger.type === 'inactivity' && (
                  <select className="form-select" style={{ marginTop: 6 }} value={form.trigger.community || '_any'} onChange={e => updateTrigger('community', e.target.value)}>
                    <option value="_any">Any community</option>
                    {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
              <div className="re-arrow">→</div>
              <div className="re-form-section">
                <div className="re-section-label">THEN</div>
                <select className="form-select" value={form.action.type} onChange={e => updateAction('type', e.target.value)} style={{ marginBottom: 8 }}>
                  {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                {(form.action.type === 'queue_post' || form.action.type === 'send_post') && (
                  <select className="form-select" value={form.action.community || '_all'} onChange={e => updateAction('community', e.target.value)}>
                    <option value="_all">All auto-post communities</option>
                    {communities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>)}
                  </select>
                )}
                {form.action.type === 'notify' && (
                  <input className="form-input" placeholder="Notification message..." value={form.action.message || ''} onChange={e => updateAction('message', e.target.value)} />
                )}
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.name.trim()}>{editId ? 'Update Rule' : 'Save Rule'}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Active Rules */}
      {rules.length > 0 && (
        <div className="re-rules-list">
          {rules.map(r => (
            <div key={r.id} className={`re-rule-card ${!r.active ? 're-rule-inactive' : ''}`}>
              <div className="re-rule-header">
                <div>
                  <div className="re-rule-name">{r.name}</div>
                  <div className="re-rule-desc">{describeTrigger(r.trigger)} → {ACTIONS.find(a => a.id === r.action.type)?.label || r.action.type}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>Last: {formatDate(r.lastFired)}</span>
                  <div className="toggle-wrapper" onClick={() => handleToggle(r.id)} style={{ marginLeft: 0 }}>
                    <div className={`toggle ${r.active ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
                  </div>
                </div>
              </div>
              <div className="re-rule-actions">
                <button className="btn btn-primary btn-sm" onClick={() => handleRunNow(r)}><Play size={12} /> Run Now</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(r)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rules Log */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Rules Log</div>
          {rulesLog.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => { localStorage.removeItem('postforge_rules_log'); setRulesLog([]); }}><Trash2 size={12} /> Clear</button>
          )}
        </div>
        {rulesLog.length > 0 ? (
          <div className="re-log">
            {rulesLog.slice(0, 20).map(entry => (
              <div key={entry.id} className="re-log-item">
                <span className="re-log-time">{formatDate(entry.date)}</span>
                <span className="re-log-rule">{entry.rule}</span>
                <span className="re-log-action">{entry.action}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 12 }}>No rules have triggered yet.</p>
        )}
      </div>
    </div>
  );
}
