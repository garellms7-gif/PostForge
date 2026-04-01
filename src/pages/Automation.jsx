import { useState, useEffect, useRef } from 'react';
import { Send, Zap, Clock, CheckSquare, Brain, Rocket, Check, X, Trash2, Timer } from 'lucide-react';
import { generatePost, resolveActiveBlocks, TONES, POST_TYPES } from '../lib/generatePost';
import { postToPlatform } from '../lib/posting';

const MODES = [
  { id: 'instant', label: 'Instant Mode', icon: Zap, desc: 'Send now to all enabled communities' },
  { id: 'scheduled', label: 'Scheduled Mode', icon: Clock, desc: 'Auto-post daily at a set time' },
  { id: 'approval', label: 'Approval Queue', icon: CheckSquare, desc: 'Review and approve before sending' },
  { id: 'smart', label: 'Smart Mode', icon: Brain, desc: 'Schedule + approval + auto-send' },
  { id: 'launch', label: 'Launch Mode', icon: Rocket, desc: 'Staggered launch across communities' },
];

const STAGGER_OPTIONS = [
  { value: 1, label: '1 hour apart' },
  { value: 2, label: '2 hours apart' },
  { value: 4, label: '4 hours apart' },
];

function getEnabledCommunities() {
  const data = localStorage.getItem('postforge_communities');
  if (!data) return [];
  return JSON.parse(data).filter(c => c.autoPost);
}

function getProduct() {
  const data = localStorage.getItem('postforge_product');
  return data ? JSON.parse(data) : {};
}

function getBlocks() {
  const data = localStorage.getItem('postforge_blocks');
  return data ? JSON.parse(data) : null;
}

function getPostLog() {
  return JSON.parse(localStorage.getItem('postforge_post_log') || '[]');
}

function savePostLog(log) {
  localStorage.setItem('postforge_post_log', JSON.stringify(log));
}

function addLogEntry(entry) {
  const log = getPostLog();
  savePostLog([entry, ...log].slice(0, 200));
}

function getQueue() {
  return JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]');
}

function saveQueue(queue) {
  localStorage.setItem('postforge_approval_queue', JSON.stringify(queue));
}

function getLaunchHistory() {
  return JSON.parse(localStorage.getItem('postforge_launch_history') || '[]');
}

function saveLaunchHistory(history) {
  localStorage.setItem('postforge_launch_history', JSON.stringify(history));
}

function getLaunchSchedule() {
  return JSON.parse(localStorage.getItem('postforge_launch_schedule') || '[]');
}

function saveLaunchSchedule(schedule) {
  localStorage.setItem('postforge_launch_schedule', JSON.stringify(schedule));
}

export default function Automation() {
  const [mode, setMode] = useState('instant');
  const [tone, setTone] = useState('Casual');
  const [postType, setPostType] = useState('Launch Announcement');
  const [sending, setSending] = useState(false);
  const [postLog, setPostLog] = useState([]);
  const [queue, setQueue] = useState([]);
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [scheduleActive, setScheduleActive] = useState(false);
  const [smartActive, setSmartActive] = useState(false);
  const [smartTime, setSmartTime] = useState('10:00');
  const scheduleRef = useRef(null);
  const smartRef = useRef(null);

  // Launch Mode state
  const [launchTopic, setLaunchTopic] = useState('');
  const [launchDate, setLaunchDate] = useState('');
  const [launchTime, setLaunchTime] = useState('10:00');
  const [staggerHours, setStaggerHours] = useState(1);
  const [launchSchedule, setLaunchSchedule] = useState([]);
  const [launchHistory, setLaunchHistory] = useState([]);
  const [launchActive, setLaunchActive] = useState(false);
  const [now, setNow] = useState(Date.now());
  const launchRef = useRef(null);

  useEffect(() => {
    setPostLog(getPostLog());
    setQueue(getQueue());
    setLaunchHistory(getLaunchHistory());
    setLaunchSchedule(getLaunchSchedule());
    const savedSchedule = localStorage.getItem('postforge_schedule');
    if (savedSchedule) {
      const s = JSON.parse(savedSchedule);
      setScheduleTime(s.time || '10:00');
      setScheduleActive(s.active || false);
    }
    const savedSmart = localStorage.getItem('postforge_smart');
    if (savedSmart) {
      const s = JSON.parse(savedSmart);
      setSmartTime(s.time || '10:00');
      setSmartActive(s.active || false);
    }
    // Set default launch date to today
    setLaunchDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Tick every second for countdown timers
  useEffect(() => {
    if (launchSchedule.length === 0 || launchSchedule.every(s => s.status !== 'pending')) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [launchSchedule]);

  // Launch scheduler — check pending items and post when time arrives
  useEffect(() => {
    if (launchRef.current) clearInterval(launchRef.current);
    const pending = launchSchedule.filter(s => s.status === 'pending');
    if (pending.length === 0) return;

    launchRef.current = setInterval(async () => {
      const current = getLaunchSchedule();
      let changed = false;
      for (const item of current) {
        if (item.status !== 'pending') continue;
        if (Date.now() >= new Date(item.scheduledAt).getTime()) {
          const communities = JSON.parse(localStorage.getItem('postforge_communities') || '[]');
          const community = communities.find(c => c.id === item.communityId);
          let status = 'success';
          let error = '';
          if (community) {
            try {
              await postToPlatform(community, item.content);
            } catch (err) {
              status = 'failed';
              error = err.message;
            }
          } else {
            status = 'failed';
            error = 'Community not found';
          }
          item.status = status === 'success' ? 'sent' : 'failed';
          item.error = error;
          addLogEntry({
            id: Date.now() + Math.random(),
            community: item.community,
            platform: item.platform,
            content: item.content.slice(0, 120) + (item.content.length > 120 ? '...' : ''),
            status,
            error,
            launchTopic: item.launchTopic,
            date: new Date().toISOString(),
          });
          changed = true;
        }
      }
      if (changed) {
        saveLaunchSchedule(current);
        setLaunchSchedule([...current]);
        setPostLog(getPostLog());

        // If all done, save to launch history
        if (current.every(s => s.status !== 'pending')) {
          const historyEntry = {
            id: Date.now(),
            topic: current[0]?.launchTopic || '',
            date: current[0]?.scheduledAt || new Date().toISOString(),
            communities: current.length,
            sent: current.filter(s => s.status === 'sent').length,
            failed: current.filter(s => s.status === 'failed').length,
          };
          const h = [historyEntry, ...getLaunchHistory()].slice(0, 50);
          saveLaunchHistory(h);
          setLaunchHistory(h);
        }
      }
    }, 3000);

    return () => clearInterval(launchRef.current);
  }, [launchSchedule]);

  // Scheduled mode timer
  useEffect(() => {
    if (scheduleRef.current) clearInterval(scheduleRef.current);
    if (!scheduleActive) return;
    localStorage.setItem('postforge_schedule', JSON.stringify({ time: scheduleTime, active: true }));
    scheduleRef.current = setInterval(() => {
      const n = new Date();
      const [h, m] = scheduleTime.split(':').map(Number);
      if (n.getHours() === h && n.getMinutes() === m && n.getSeconds() < 10) handleInstantSend();
    }, 5000);
    return () => clearInterval(scheduleRef.current);
  }, [scheduleActive, scheduleTime, tone, postType]);

  // Smart mode timer
  useEffect(() => {
    if (smartRef.current) clearInterval(smartRef.current);
    if (!smartActive) return;
    localStorage.setItem('postforge_smart', JSON.stringify({ time: smartTime, active: true }));
    smartRef.current = setInterval(() => {
      const n = new Date();
      const [h, m] = smartTime.split(':').map(Number);
      if (n.getHours() === h && n.getMinutes() === m && n.getSeconds() < 10) {
        handleGenerateQueue();
        const currentQueue = getQueue();
        currentQueue.filter(q => q.status === 'approved').forEach(item => sendQueueItem(item));
      }
    }, 5000);
    return () => clearInterval(smartRef.current);
  }, [smartActive, smartTime, tone, postType]);

  const handleInstantSend = async () => {
    const communities = getEnabledCommunities();
    if (communities.length === 0) return;
    const product = getProduct();
    const blocks = getBlocks();
    setSending(true);
    for (const community of communities) {
      const activeFlags = blocks ? resolveActiveBlocks(blocks, community) : {};
      const content = generatePost(product, community, tone, postType, blocks, activeFlags);
      let status = 'success';
      let error = '';
      try { await postToPlatform(community, content); } catch (err) { status = 'failed'; error = err.message; }
      addLogEntry({ id: Date.now() + Math.random(), community: community.name, platform: community.platform, content: content.slice(0, 120) + (content.length > 120 ? '...' : ''), status, error, date: new Date().toISOString() });
    }
    setSending(false);
    setPostLog(getPostLog());
  };

  const handleGenerateQueue = () => {
    const communities = getEnabledCommunities();
    if (communities.length === 0) return;
    const product = getProduct();
    const blocks = getBlocks();
    const newItems = communities.map(community => {
      const activeFlags = blocks ? resolveActiveBlocks(blocks, community) : {};
      return { id: Date.now() + Math.random(), community: community.name, communityId: community.id, platform: community.platform, content: generatePost(product, community, tone, postType, blocks, activeFlags), status: 'pending', date: new Date().toISOString() };
    });
    const updated = [...newItems, ...getQueue()];
    saveQueue(updated);
    setQueue(updated);
  };

  const handleApprove = (id) => { const updated = queue.map(q => q.id === id ? { ...q, status: 'approved' } : q); saveQueue(updated); setQueue(updated); };
  const handleReject = (id) => { const updated = queue.filter(q => q.id !== id); saveQueue(updated); setQueue(updated); };

  const sendQueueItem = async (item) => {
    const communities = JSON.parse(localStorage.getItem('postforge_communities') || '[]');
    const community = communities.find(c => c.id === item.communityId) || communities.find(c => c.name === item.community);
    if (!community) return;
    let status = 'success'; let error = '';
    try { await postToPlatform(community, item.content); } catch (err) { status = 'failed'; error = err.message; }
    addLogEntry({ id: Date.now() + Math.random(), community: item.community, platform: item.platform, content: item.content.slice(0, 120) + (item.content.length > 120 ? '...' : ''), status, error, date: new Date().toISOString() });
    const updatedQueue = getQueue().filter(q => q.id !== item.id);
    saveQueue(updatedQueue); setQueue(updatedQueue); setPostLog(getPostLog());
  };

  const handleSendApproved = async () => {
    const approved = queue.filter(q => q.status === 'approved');
    setSending(true);
    for (const item of approved) await sendQueueItem(item);
    setSending(false);
  };

  const handleClearLog = () => { savePostLog([]); setPostLog([]); };

  // Launch Mode: generate schedule preview
  const buildLaunchPreview = () => {
    const communities = getEnabledCommunities();
    if (communities.length === 0 || !launchDate || !launchTopic.trim()) return [];
    const startTime = new Date(`${launchDate}T${launchTime}:00`);
    return communities.map((c, i) => ({
      community: c.name,
      communityId: c.id,
      platform: c.platform,
      scheduledAt: new Date(startTime.getTime() + i * staggerHours * 60 * 60 * 1000).toISOString(),
    }));
  };

  const launchPreview = mode === 'launch' ? buildLaunchPreview() : [];

  // Launch Mode: activate
  const handleLaunch = () => {
    const communities = getEnabledCommunities();
    if (communities.length === 0 || !launchTopic.trim()) return;
    const product = getProduct();
    const blocks = getBlocks();
    const startTime = new Date(`${launchDate}T${launchTime}:00`);

    const schedule = communities.map((community, i) => {
      const activeFlags = blocks ? resolveActiveBlocks(blocks, community) : {};
      // Generate a launch-specific post incorporating the topic
      const launchProduct = { ...product, tagline: launchTopic, description: product.description ? `${launchTopic}. ${product.description}` : launchTopic };
      const content = generatePost(launchProduct, community, tone, 'Launch Announcement', blocks, activeFlags);
      return {
        id: Date.now() + Math.random() + i,
        launchTopic: launchTopic.trim(),
        community: community.name,
        communityId: community.id,
        platform: community.platform,
        content,
        scheduledAt: new Date(startTime.getTime() + i * staggerHours * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        error: '',
      };
    });

    saveLaunchSchedule(schedule);
    setLaunchSchedule(schedule);
    setLaunchActive(true);
  };

  const handleCancelLaunch = () => {
    saveLaunchSchedule([]);
    setLaunchSchedule([]);
    setLaunchActive(false);
  };

  const enabledCount = getEnabledCommunities().length;

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatCountdown = (isoTarget) => {
    const diff = new Date(isoTarget).getTime() - now;
    if (diff <= 0) return 'Posting...';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div>
      <h1 className="page-title">Automation</h1>
      <p className="page-subtitle">Auto-post to your enabled communities. {enabledCount} community{enabledCount !== 1 ? 'ies' : ''} enabled.</p>

      {/* Mode selector */}
      <div className="mode-grid mode-grid-5">
        {MODES.map(m => (
          <button key={m.id} className={`mode-card ${mode === m.id ? 'mode-card-active' : ''}`} onClick={() => setMode(m.id)}>
            <m.icon size={20} />
            <div className="mode-card-label">{m.label}</div>
            <div className="mode-card-desc">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Post settings (not shown for launch mode which has its own) */}
      {mode !== 'launch' && (
        <div className="card">
          <div className="card-title">Post Settings</div>
          <div className="generator-controls">
            <div className="form-group">
              <label className="form-label">Post Type</label>
              <select className="form-select" value={postType} onChange={e => setPostType(e.target.value)}>
                {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tone</label>
              <select className="form-select" value={tone} onChange={e => setTone(e.target.value)}>
                {TONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ===== Instant Mode ===== */}
      {mode === 'instant' && (
        <div className="card">
          <div className="card-title">Instant Post</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>Generate and immediately send a post to all {enabledCount} enabled communities.</p>
          <button className="btn btn-primary" onClick={handleInstantSend} disabled={sending || enabledCount === 0}>
            {sending ? <span className="spinner" /> : <Send size={16} />}
            {sending ? 'Sending...' : 'Send Now'}
          </button>
          {enabledCount === 0 && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>Enable auto-post on at least one community first.</p>}
        </div>
      )}

      {/* ===== Scheduled Mode ===== */}
      {mode === 'scheduled' && (
        <div className="card">
          <div className="card-title">Scheduled Posting</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>Automatically generate and post every day at the specified time.</p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label">Daily Post Time</label>
              <input className="form-input" type="time" value={scheduleTime} onChange={e => { setScheduleTime(e.target.value); if (scheduleActive) localStorage.setItem('postforge_schedule', JSON.stringify({ time: e.target.value, active: true })); }} />
            </div>
            <button className={`btn ${scheduleActive ? 'btn-danger' : 'btn-primary'}`} onClick={() => { const next = !scheduleActive; setScheduleActive(next); localStorage.setItem('postforge_schedule', JSON.stringify({ time: scheduleTime, active: next })); }} disabled={enabledCount === 0}>
              {scheduleActive ? 'Stop Schedule' : 'Start Schedule'}
            </button>
          </div>
          {scheduleActive && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 12 }}>Schedule active — posting daily at {scheduleTime}.</p>}
        </div>
      )}

      {/* ===== Approval Queue ===== */}
      {mode === 'approval' && (
        <div className="card">
          <div className="card-title">Approval Queue</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>Generate posts for review. Approve or reject before sending.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={handleGenerateQueue} disabled={enabledCount === 0}>Generate Posts for Review</button>
            {queue.filter(q => q.status === 'approved').length > 0 && (
              <button className="btn btn-secondary" onClick={handleSendApproved} disabled={sending}>
                {sending ? <span className="spinner" /> : <Send size={16} />} Send {queue.filter(q => q.status === 'approved').length} Approved
              </button>
            )}
          </div>
          {queue.length > 0 ? (
            <div className="queue-list">
              {queue.map(item => (
                <div key={item.id} className={`queue-item ${item.status === 'approved' ? 'queue-approved' : ''}`}>
                  <div className="queue-item-header">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={`platform-badge ${item.platform.toLowerCase()}`}>{item.platform}</span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.community}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDate(item.date)}</span>
                  </div>
                  <div className="queue-item-content">{item.content}</div>
                  <div className="queue-item-actions">
                    {item.status === 'pending' && (<>
                      <button className="btn btn-primary btn-sm" onClick={() => handleApprove(item.id)}><Check size={14} /> Approve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleReject(item.id)}><X size={14} /> Reject</button>
                    </>)}
                    {item.status === 'approved' && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>Approved — ready to send</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : <p style={{ color: 'var(--muted)', fontSize: 14 }}>No posts in the queue.</p>}
        </div>
      )}

      {/* ===== Smart Mode ===== */}
      {mode === 'smart' && (
        <div className="card">
          <div className="card-title">Smart Mode</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>Auto-generates posts and queues them for approval. Approved posts are sent automatically at the scheduled time.</p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Daily Time</label>
              <input className="form-input" type="time" value={smartTime} onChange={e => { setSmartTime(e.target.value); if (smartActive) localStorage.setItem('postforge_smart', JSON.stringify({ time: e.target.value, active: true })); }} />
            </div>
            <button className={`btn ${smartActive ? 'btn-danger' : 'btn-primary'}`} onClick={() => { const next = !smartActive; setSmartActive(next); localStorage.setItem('postforge_smart', JSON.stringify({ time: smartTime, active: next })); }} disabled={enabledCount === 0}>
              {smartActive ? 'Stop Smart Mode' : 'Activate Smart Mode'}
            </button>
          </div>
          {smartActive && <p style={{ color: 'var(--success)', fontSize: 13 }}>Smart Mode active — generates queue and sends approved posts daily at {smartTime}.</p>}
          {queue.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Current Queue ({queue.length})</div>
              <div className="queue-list">
                {queue.map(item => (
                  <div key={item.id} className={`queue-item ${item.status === 'approved' ? 'queue-approved' : ''}`}>
                    <div className="queue-item-header">
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className={`platform-badge ${item.platform.toLowerCase()}`}>{item.platform}</span>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.community}</span>
                      </div>
                      {item.status === 'approved' ? <span style={{ fontSize: 12, color: 'var(--success)' }}>Approved</span> : <span style={{ fontSize: 12, color: 'var(--muted)' }}>Pending</span>}
                    </div>
                    <div className="queue-item-content">{item.content}</div>
                    <div className="queue-item-actions">
                      {item.status === 'pending' && (<>
                        <button className="btn btn-primary btn-sm" onClick={() => handleApprove(item.id)}><Check size={14} /> Approve</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleReject(item.id)}><X size={14} /> Reject</button>
                      </>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Launch Mode ===== */}
      {mode === 'launch' && (
        <>
          <div className="card">
            <div className="card-title">Launch Configuration</div>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Launch Topic</label>
                <input className="form-input" placeholder='e.g. "ColdMailAI v2 is live"' value={launchTopic} onChange={e => setLaunchTopic(e.target.value)} disabled={launchActive} />
              </div>
              <div className="form-group">
                <label className="form-label">Launch Date</label>
                <input className="form-input" type="date" value={launchDate} onChange={e => setLaunchDate(e.target.value)} disabled={launchActive} />
              </div>
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input className="form-input" type="time" value={launchTime} onChange={e => setLaunchTime(e.target.value)} disabled={launchActive} />
              </div>
              <div className="form-group">
                <label className="form-label">Stagger</label>
                <select className="form-select" value={staggerHours} onChange={e => setStaggerHours(Number(e.target.value))} disabled={launchActive}>
                  {STAGGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tone</label>
                <select className="form-select" value={tone} onChange={e => setTone(e.target.value)} disabled={launchActive}>
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              {!launchActive ? (
                <button className="btn btn-primary" onClick={handleLaunch} disabled={enabledCount === 0 || !launchTopic.trim()}>
                  <Rocket size={16} /> Launch
                </button>
              ) : (
                <button className="btn btn-danger" onClick={handleCancelLaunch}>
                  <X size={16} /> Cancel Launch
                </button>
              )}
            </div>
            {enabledCount === 0 && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>Enable auto-post on at least one community first.</p>}
          </div>

          {/* Schedule Preview / Active Schedule */}
          {(launchActive ? launchSchedule : launchPreview).length > 0 && (
            <div className="card">
              <div className="card-title">{launchActive ? 'Launch Schedule' : 'Schedule Preview'}</div>
              <div className="launch-schedule-list">
                {(launchActive ? launchSchedule : launchPreview).map((item, i) => (
                  <div key={i} className={`launch-schedule-item ${launchActive && item.status === 'sent' ? 'launch-sent' : ''} ${launchActive && item.status === 'failed' ? 'launch-failed' : ''}`}>
                    <div className="launch-schedule-order">{i + 1}</div>
                    <div className="launch-schedule-info">
                      <span className={`platform-badge ${item.platform.toLowerCase()}`}>{item.platform}</span>
                      <span style={{ fontSize: 13 }}>{item.community}</span>
                    </div>
                    <div className="launch-schedule-time">
                      {formatDate(item.scheduledAt)}
                    </div>
                    {launchActive && item.status === 'pending' && (
                      <div className="launch-countdown">
                        <Timer size={12} />
                        {formatCountdown(item.scheduledAt)}
                      </div>
                    )}
                    {launchActive && item.status === 'sent' && (
                      <span className="launch-status-badge launch-status-sent"><Check size={12} /> Sent</span>
                    )}
                    {launchActive && item.status === 'failed' && (
                      <span className="launch-status-badge launch-status-failed"><X size={12} /> Failed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Launch History */}
          {launchHistory.length > 0 && (
            <div className="card">
              <div className="card-title">Launch History</div>
              <div className="launch-history-list">
                {launchHistory.map(h => (
                  <div key={h.id} className="launch-history-item">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.topic}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{formatDate(h.date)}</div>
                    </div>
                    <div className="launch-history-stats">
                      <span className="launch-history-stat">{h.communities} communities</span>
                      <span className="launch-history-stat launch-stat-sent">{h.sent} sent</span>
                      {h.failed > 0 && <span className="launch-history-stat launch-stat-failed">{h.failed} failed</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Posting Log */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Posting Log</div>
          {postLog.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleClearLog}><Trash2 size={14} /> Clear</button>
          )}
        </div>
        {postLog.length > 0 ? (
          <div className="log-list">
            {postLog.map(entry => (
              <div key={entry.id} className="log-item">
                <div className="log-item-left">
                  <span className={`log-status ${entry.status}`}>
                    {entry.status === 'success' ? <Check size={12} /> : <X size={12} />}
                  </span>
                  <span className={`platform-badge ${entry.platform.toLowerCase()}`}>{entry.platform}</span>
                  <span style={{ fontSize: 13 }}>{entry.community}</span>
                  {entry.productName && <span className="log-product-name">{entry.productName}</span>}
                  {entry.launchTopic && <span className="log-launch-tag"><Rocket size={10} /> {entry.launchTopic}</span>}
                </div>
                <div className="log-item-right">
                  <span className="log-preview">{entry.content}</span>
                  <span className="log-date">{formatDate(entry.date)}</span>
                </div>
                {entry.error && <div className="log-error">{entry.error}</div>}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 24 }}>No posts sent yet.</p>
        )}
      </div>
    </div>
  );
}
