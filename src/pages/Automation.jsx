import { useState, useEffect, useRef } from 'react';
import { Send, Zap, Clock, CheckSquare, Brain, Check, X, Trash2 } from 'lucide-react';
import { generatePost, TONES, POST_TYPES } from '../lib/generatePost';
import { postToPlatform } from '../lib/posting';

const MODES = [
  { id: 'instant', label: 'Instant Mode', icon: Zap, desc: 'Send now to all enabled communities' },
  { id: 'scheduled', label: 'Scheduled Mode', icon: Clock, desc: 'Auto-post daily at a set time' },
  { id: 'approval', label: 'Approval Queue', icon: CheckSquare, desc: 'Review and approve before sending' },
  { id: 'smart', label: 'Smart Mode', icon: Brain, desc: 'Schedule + approval + auto-send' },
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

function getPostLog() {
  return JSON.parse(localStorage.getItem('postforge_post_log') || '[]');
}

function savePostLog(log) {
  localStorage.setItem('postforge_post_log', JSON.stringify(log));
}

function addLogEntry(entry) {
  const log = getPostLog();
  savePostLog([entry, ...log].slice(0, 100));
}

function getQueue() {
  return JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]');
}

function saveQueue(queue) {
  localStorage.setItem('postforge_approval_queue', JSON.stringify(queue));
}

export default function Automation() {
  const [mode, setMode] = useState('instant');
  const [tone, setTone] = useState('Casual');
  const [postType, setPostType] = useState('Launch Announcement');
  const [sending, setSending] = useState(false);
  const [postLog, setPostLog] = useState([]);
  const [queue, setQueue] = useState([]);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleActive, setScheduleActive] = useState(false);
  const [smartActive, setSmartActive] = useState(false);
  const [smartTime, setSmartTime] = useState('09:00');
  const scheduleRef = useRef(null);
  const smartRef = useRef(null);

  useEffect(() => {
    setPostLog(getPostLog());
    setQueue(getQueue());
    const savedSchedule = localStorage.getItem('postforge_schedule');
    if (savedSchedule) {
      const s = JSON.parse(savedSchedule);
      setScheduleTime(s.time || '09:00');
      setScheduleActive(s.active || false);
    }
    const savedSmart = localStorage.getItem('postforge_smart');
    if (savedSmart) {
      const s = JSON.parse(savedSmart);
      setSmartTime(s.time || '09:00');
      setSmartActive(s.active || false);
    }
  }, []);

  // Scheduled mode timer
  useEffect(() => {
    if (scheduleRef.current) clearInterval(scheduleRef.current);
    if (!scheduleActive) return;

    localStorage.setItem('postforge_schedule', JSON.stringify({ time: scheduleTime, active: true }));

    scheduleRef.current = setInterval(() => {
      const now = new Date();
      const [h, m] = scheduleTime.split(':').map(Number);
      if (now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 10) {
        handleInstantSend();
      }
    }, 5000);

    return () => clearInterval(scheduleRef.current);
  }, [scheduleActive, scheduleTime, tone, postType]);

  // Smart mode timer
  useEffect(() => {
    if (smartRef.current) clearInterval(smartRef.current);
    if (!smartActive) return;

    localStorage.setItem('postforge_smart', JSON.stringify({ time: smartTime, active: true }));

    smartRef.current = setInterval(() => {
      const now = new Date();
      const [h, m] = smartTime.split(':').map(Number);
      if (now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 10) {
        // Generate and queue for approval
        handleGenerateQueue();
        // Auto-send any already-approved items
        const currentQueue = getQueue();
        const approved = currentQueue.filter(q => q.status === 'approved');
        approved.forEach(item => sendQueueItem(item));
      }
    }, 5000);

    return () => clearInterval(smartRef.current);
  }, [smartActive, smartTime, tone, postType]);

  const handleInstantSend = async () => {
    const communities = getEnabledCommunities();
    if (communities.length === 0) return;
    const product = getProduct();
    setSending(true);

    for (const community of communities) {
      const content = generatePost(product, community, tone, postType);
      let status = 'success';
      let error = '';
      try {
        await postToPlatform(community, content);
      } catch (err) {
        status = 'failed';
        error = err.message;
      }
      const entry = {
        id: Date.now() + Math.random(),
        community: community.name,
        platform: community.platform,
        content: content.slice(0, 120) + (content.length > 120 ? '...' : ''),
        status,
        error,
        date: new Date().toISOString(),
      };
      addLogEntry(entry);
    }

    setSending(false);
    setPostLog(getPostLog());
  };

  const handleGenerateQueue = () => {
    const communities = getEnabledCommunities();
    if (communities.length === 0) return;
    const product = getProduct();

    const newItems = communities.map(community => ({
      id: Date.now() + Math.random(),
      community: community.name,
      communityId: community.id,
      platform: community.platform,
      content: generatePost(product, community, tone, postType),
      status: 'pending',
      date: new Date().toISOString(),
    }));

    const updated = [...newItems, ...getQueue()];
    saveQueue(updated);
    setQueue(updated);
  };

  const handleApprove = (id) => {
    const updated = queue.map(q => q.id === id ? { ...q, status: 'approved' } : q);
    saveQueue(updated);
    setQueue(updated);
  };

  const handleReject = (id) => {
    const updated = queue.filter(q => q.id !== id);
    saveQueue(updated);
    setQueue(updated);
  };

  const sendQueueItem = async (item) => {
    const communities = JSON.parse(localStorage.getItem('postforge_communities') || '[]');
    const community = communities.find(c => c.id === item.communityId) ||
      communities.find(c => c.name === item.community);
    if (!community) return;

    let status = 'success';
    let error = '';
    try {
      await postToPlatform(community, item.content);
    } catch (err) {
      status = 'failed';
      error = err.message;
    }

    addLogEntry({
      id: Date.now() + Math.random(),
      community: item.community,
      platform: item.platform,
      content: item.content.slice(0, 120) + (item.content.length > 120 ? '...' : ''),
      status,
      error,
      date: new Date().toISOString(),
    });

    // Remove from queue
    const updatedQueue = getQueue().filter(q => q.id !== item.id);
    saveQueue(updatedQueue);
    setQueue(updatedQueue);
    setPostLog(getPostLog());
  };

  const handleSendApproved = async () => {
    const approved = queue.filter(q => q.status === 'approved');
    setSending(true);
    for (const item of approved) {
      await sendQueueItem(item);
    }
    setSending(false);
  };

  const handleClearLog = () => {
    savePostLog([]);
    setPostLog([]);
  };

  const enabledCount = getEnabledCommunities().length;

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div>
      <h1 className="page-title">Automation</h1>
      <p className="page-subtitle">Auto-post to your enabled communities. {enabledCount} community{enabledCount !== 1 ? 'ies' : ''} enabled.</p>

      {/* Mode selector */}
      <div className="mode-grid">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`mode-card ${mode === m.id ? 'mode-card-active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            <m.icon size={20} />
            <div className="mode-card-label">{m.label}</div>
            <div className="mode-card-desc">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Post settings */}
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

      {/* Mode-specific panel */}
      {mode === 'instant' && (
        <div className="card">
          <div className="card-title">Instant Post</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
            Generate and immediately send a post to all {enabledCount} enabled communities.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleInstantSend}
            disabled={sending || enabledCount === 0}
          >
            {sending ? <span className="spinner" /> : <Send size={16} />}
            {sending ? 'Sending...' : 'Send Now'}
          </button>
          {enabledCount === 0 && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>
              Enable auto-post on at least one community first.
            </p>
          )}
        </div>
      )}

      {mode === 'scheduled' && (
        <div className="card">
          <div className="card-title">Scheduled Posting</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
            Automatically generate and post every day at the specified time.
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label">Daily Post Time</label>
              <input
                className="form-input"
                type="time"
                value={scheduleTime}
                onChange={e => {
                  setScheduleTime(e.target.value);
                  if (scheduleActive) {
                    localStorage.setItem('postforge_schedule', JSON.stringify({ time: e.target.value, active: true }));
                  }
                }}
              />
            </div>
            <button
              className={`btn ${scheduleActive ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => {
                const next = !scheduleActive;
                setScheduleActive(next);
                localStorage.setItem('postforge_schedule', JSON.stringify({ time: scheduleTime, active: next }));
              }}
              disabled={enabledCount === 0}
            >
              {scheduleActive ? 'Stop Schedule' : 'Start Schedule'}
            </button>
          </div>
          {scheduleActive && (
            <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 12 }}>
              Schedule active — posting daily at {scheduleTime}.
            </p>
          )}
        </div>
      )}

      {mode === 'approval' && (
        <div className="card">
          <div className="card-title">Approval Queue</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
            Generate posts for review. Approve or reject before sending.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={handleGenerateQueue} disabled={enabledCount === 0}>
              Generate Posts for Review
            </button>
            {queue.filter(q => q.status === 'approved').length > 0 && (
              <button className="btn btn-secondary" onClick={handleSendApproved} disabled={sending}>
                {sending ? <span className="spinner" /> : <Send size={16} />}
                Send {queue.filter(q => q.status === 'approved').length} Approved
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
                    {item.status === 'pending' && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => handleApprove(item.id)}>
                          <Check size={14} /> Approve
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleReject(item.id)}>
                          <X size={14} /> Reject
                        </button>
                      </>
                    )}
                    {item.status === 'approved' && (
                      <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>Approved — ready to send</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No posts in the queue.</p>
          )}
        </div>
      )}

      {mode === 'smart' && (
        <div className="card">
          <div className="card-title">Smart Mode</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
            Auto-generates posts and queues them for approval. Approved posts are sent automatically at the scheduled time.
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Daily Time</label>
              <input
                className="form-input"
                type="time"
                value={smartTime}
                onChange={e => {
                  setSmartTime(e.target.value);
                  if (smartActive) {
                    localStorage.setItem('postforge_smart', JSON.stringify({ time: e.target.value, active: true }));
                  }
                }}
              />
            </div>
            <button
              className={`btn ${smartActive ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => {
                const next = !smartActive;
                setSmartActive(next);
                localStorage.setItem('postforge_smart', JSON.stringify({ time: smartTime, active: next }));
              }}
              disabled={enabledCount === 0}
            >
              {smartActive ? 'Stop Smart Mode' : 'Activate Smart Mode'}
            </button>
          </div>
          {smartActive && (
            <p style={{ color: 'var(--success)', fontSize: 13 }}>
              Smart Mode active — generates queue and sends approved posts daily at {smartTime}.
            </p>
          )}

          {/* Show current queue inline */}
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
                      {item.status === 'approved'
                        ? <span style={{ fontSize: 12, color: 'var(--success)' }}>Approved</span>
                        : <span style={{ fontSize: 12, color: 'var(--muted)' }}>Pending</span>
                      }
                    </div>
                    <div className="queue-item-content">{item.content}</div>
                    <div className="queue-item-actions">
                      {item.status === 'pending' && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => handleApprove(item.id)}>
                            <Check size={14} /> Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleReject(item.id)}>
                            <X size={14} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Posting Log */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Posting Log</div>
          {postLog.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleClearLog}>
              <Trash2 size={14} /> Clear
            </button>
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
                </div>
                <div className="log-item-right">
                  <span className="log-preview">{entry.content}</span>
                  <span className="log-date">{formatDate(entry.date)}</span>
                </div>
                {entry.error && (
                  <div className="log-error">{entry.error}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 24 }}>
            No posts sent yet.
          </p>
        )}
      </div>
    </div>
  );
}
