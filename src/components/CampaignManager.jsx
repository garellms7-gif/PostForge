import { useState, useEffect } from 'react';
import { Plus, Play, Pause, Square, Trash2, ChevronDown, ChevronUp, Check, Zap } from 'lucide-react';
import { generatePost, resolveActiveBlocks } from '../lib/generatePost';
import CampaignOptimizer from './CampaignOptimizer';

function getCampaigns() { return JSON.parse(localStorage.getItem('postforge_campaigns') || '[]'); }
function saveCampaigns(c) { localStorage.setItem('postforge_campaigns', JSON.stringify(c)); }
function getCommunities() { return JSON.parse(localStorage.getItem('postforge_communities') || '[]'); }
function getProducts() { return JSON.parse(localStorage.getItem('postforge_products') || '[]'); }
function getProduct() { const d = localStorage.getItem('postforge_product'); return d ? JSON.parse(d) : {}; }
function getBlocks() { const d = localStorage.getItem('postforge_blocks'); return d ? JSON.parse(d) : null; }
function getQueue() { return JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]'); }
function saveQueue(q) { localStorage.setItem('postforge_approval_queue', JSON.stringify(q)); }
function getTopPosts() { return JSON.parse(localStorage.getItem('postforge_top_posts') || '[]'); }

const GOALS = ['Brand awareness', 'Product launch', 'Community building', 'Drive sales'];
const FREQUENCIES = [
  { value: 'daily', label: 'Once a day' },
  { value: 'twice', label: 'Twice a day' },
  { value: 'eod', label: 'Every other day' },
  { value: 'custom', label: 'Custom' },
];
const POST_TYPES = ['Launch Announcement', 'Feature Update', 'Show & Tell', 'Tips & Value', 'Ask for Feedback', 'Milestone'];

function generateSchedule(form, communities, products) {
  const start = new Date(form.startDate + 'T10:00:00');
  const end = new Date(form.endDate + 'T23:59:59');
  const schedule = [];
  const targetComms = communities.filter(c => form.communityIds.includes(c.id));
  const targetProducts = products.filter(p => form.productIds.includes(p.id));
  if (targetComms.length === 0 || targetProducts.length === 0) return [];

  let dayStep = 1;
  let postsPerDay = 1;
  if (form.frequency === 'twice') postsPerDay = 2;
  if (form.frequency === 'eod') dayStep = 2;
  if (form.frequency === 'custom') { dayStep = form.customDays || 2; postsPerDay = 1; }

  const current = new Date(start);
  let idx = 0;
  while (current <= end) {
    for (let p = 0; p < postsPerDay; p++) {
      const comm = targetComms[idx % targetComms.length];
      const prod = targetProducts[idx % targetProducts.length];
      const postType = POST_TYPES[idx % POST_TYPES.length];
      const hour = p === 0 ? 10 : 16;
      const schedAt = new Date(current);
      schedAt.setHours(hour, 0, 0, 0);
      schedule.push({
        id: Date.now() + Math.random() + idx,
        community: comm.name,
        communityId: comm.id,
        platform: comm.platform,
        productName: prod.name,
        postType,
        scheduledAt: schedAt.toISOString(),
        status: 'pending',
        content: null,
      });
      idx++;
    }
    current.setDate(current.getDate() + dayStep);
  }
  return schedule;
}

const EMPTY_FORM = { name: '', startDate: '', endDate: '', productIds: [], communityIds: [], goal: 'Brand awareness', frequency: 'daily', customDays: 2 };

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [preview, setPreview] = useState(null);
  const [communities] = useState(getCommunities());
  const [products] = useState(getProducts());
  const [expandedId, setExpandedId] = useState(null);
  const [detailTab, setDetailTab] = useState('details');

  useEffect(() => { setCampaigns(getCampaigns()); }, []);

  const updateForm = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleId = (key, id) => {
    const arr = form[key];
    updateForm(key, arr.includes(id) ? arr.filter(i => i !== id) : [...arr, id]);
  };

  const handlePreview = () => {
    const sched = generateSchedule(form, communities, products);
    setPreview(sched);
  };

  const handleCreate = () => {
    if (!preview || !form.name.trim()) return;
    const product = getProduct();
    const blocks = getBlocks();

    // Generate content for each post
    const postsWithContent = preview.map(p => {
      const comm = communities.find(c => c.id === p.communityId);
      const activeFlags = blocks && comm ? resolveActiveBlocks(blocks, comm) : {};
      const content = generatePost(product, comm, 'Casual', p.postType, blocks, activeFlags);
      return { ...p, content };
    });

    const campaign = {
      id: Date.now(),
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      goal: form.goal,
      frequency: form.frequency,
      productIds: form.productIds,
      communityIds: form.communityIds,
      posts: postsWithContent,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    // Add posts to approval queue
    const queue = getQueue();
    for (const p of postsWithContent) {
      queue.push({ ...p, campaignId: campaign.id, campaignName: campaign.name, date: p.scheduledAt });
    }
    saveQueue(queue);

    const updated = [campaign, ...campaigns];
    saveCampaigns(updated);
    setCampaigns(updated);
    setForm({ ...EMPTY_FORM });
    setPreview(null);
    setShowForm(false);
  };

  const handlePause = (id) => {
    const updated = campaigns.map(c => c.id === id ? { ...c, status: c.status === 'paused' ? 'active' : 'paused' } : c);
    saveCampaigns(updated); setCampaigns(updated);
  };

  const handleEnd = (id) => {
    const updated = campaigns.map(c => c.id === id ? { ...c, status: 'completed' } : c);
    saveCampaigns(updated); setCampaigns(updated);
  };

  const handleDelete = (id) => {
    const updated = campaigns.filter(c => c.id !== id);
    saveCampaigns(updated); setCampaigns(updated);
  };

  const handleUpdateCampaign = (id, updates) => {
    const updated = campaigns.map(c => c.id === id ? { ...c, ...updates } : c);
    saveCampaigns(updated); setCampaigns(updated);
  };

  const activeCampaigns = campaigns.filter(c => c.status === 'active' || c.status === 'paused');
  const completedCampaigns = campaigns.filter(c => c.status === 'completed');

  const getCampaignProgress = (c) => {
    const start = new Date(c.startDate);
    const end = new Date(c.endDate);
    const now = new Date();
    const total = Math.max(1, (end - start) / 86400000);
    const elapsed = Math.max(0, (Math.min(now, end) - start) / 86400000);
    return Math.round((elapsed / total) * 100);
  };

  const getCampaignSentCount = (c) => {
    const queue = getQueue();
    return queue.filter(q => q.campaignId === c.id && (q.status === 'approved' || q.status === 'sent')).length;
  };

  const getTopPerformers = (c) => {
    const top = getTopPosts();
    const commNames = communities.filter(cm => c.communityIds.includes(cm.id)).map(cm => cm.name);
    return top.filter(t => commNames.includes(t.community)).slice(0, 3);
  };

  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div>
      {/* Header */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showForm ? 16 : 0 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>Campaign Manager</div>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Coordinated posting across products and communities.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(!showForm); setPreview(null); }}>
            <Plus size={14} /> {showForm ? 'Cancel' : 'New Campaign'}
          </button>
        </div>

        {/* New Campaign Form */}
        {showForm && (
          <div className="cm-form">
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Campaign Name</label>
                <input className="form-input" placeholder='e.g. "April Launch Push"' value={form.name} onChange={e => updateForm('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" type="date" value={form.startDate} onChange={e => updateForm('startDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input className="form-input" type="date" value={form.endDate} onChange={e => updateForm('endDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Goal</label>
                <select className="form-select" value={form.goal} onChange={e => updateForm('goal', e.target.value)}>
                  {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select className="form-select" value={form.frequency} onChange={e => updateForm('frequency', e.target.value)}>
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              {form.frequency === 'custom' && (
                <div className="form-group">
                  <label className="form-label">Every X days</label>
                  <input className="form-input" type="number" min="1" max="14" value={form.customDays} onChange={e => updateForm('customDays', Number(e.target.value))} />
                </div>
              )}
              <div className="form-group full-width">
                <label className="form-label">Products</label>
                <div className="cm-chip-list">
                  {products.map(p => (
                    <button key={p.id} className={`cm-chip ${form.productIds.includes(p.id) ? 'cm-chip-active' : ''}`} onClick={() => toggleId('productIds', p.id)}>
                      {p.name || 'Untitled'}
                    </button>
                  ))}
                  {products.length === 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>No products</span>}
                </div>
              </div>
              <div className="form-group full-width">
                <label className="form-label">Communities</label>
                <div className="cm-chip-list">
                  {communities.map(c => (
                    <button key={c.id} className={`cm-chip ${form.communityIds.includes(c.id) ? 'cm-chip-active' : ''}`} onClick={() => toggleId('communityIds', c.id)}>
                      <span className={`platform-badge ${c.platform.toLowerCase()}`} style={{ marginRight: 4 }}>{c.platform}</span>{c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={handlePreview} disabled={!form.name.trim() || !form.startDate || !form.endDate || form.productIds.length === 0 || form.communityIds.length === 0}>
                Preview Schedule
              </button>
              {preview && (
                <button className="btn btn-primary btn-sm" onClick={handleCreate}>
                  <Check size={13} /> Create Campaign ({preview.length} posts)
                </button>
              )}
            </div>

            {/* Schedule Preview */}
            {preview && (
              <div className="cm-preview">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Schedule Preview ({preview.length} posts)</div>
                <div className="cm-preview-list">
                  {preview.slice(0, 20).map((p, i) => (
                    <div key={i} className="cm-preview-item">
                      <span className="cm-preview-date">{formatDate(p.scheduledAt)}</span>
                      <span className={`platform-badge ${p.platform.toLowerCase()}`}>{p.platform}</span>
                      <span style={{ fontSize: 12 }}>{p.community}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{p.productName} · {p.postType}</span>
                    </div>
                  ))}
                  {preview.length > 20 && <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 6 }}>...and {preview.length - 20} more</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Campaigns */}
      {activeCampaigns.length > 0 && (
        <div className="cm-campaigns">
          {activeCampaigns.map(c => {
            const progress = getCampaignProgress(c);
            const sent = getCampaignSentCount(c);
            const total = (c.posts || []).length;
            const isExpanded = expandedId === c.id;
            const topPerf = getTopPerformers(c);
            return (
              <div key={c.id} className={`cm-card ${c.status === 'paused' ? 'cm-card-paused' : ''}`}>
                <div className="cm-card-header">
                  <div>
                    <div className="cm-card-name">{c.name}</div>
                    <div className="cm-card-meta">{formatDate(c.startDate)} — {formatDate(c.endDate)} · {c.goal}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span className={`cm-status-badge cm-status-${c.status}`}>{c.status}</span>
                  </div>
                </div>

                <div className="cm-progress-row">
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{progress}% elapsed</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sent}/{total} posts sent</span>
                </div>
                <div className="goal-bar-wrap"><div className="goal-bar" style={{ width: `${progress}%`, background: progress >= 100 ? 'var(--success)' : 'var(--accent)' }} /></div>

                <div className="cm-card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => handlePause(c.id)}>
                    {c.status === 'paused' ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleEnd(c.id)}><Square size={12} /> End</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Details
                  </button>
                </div>

                {isExpanded && (
                  <div className="cm-details">
                    <div className="cr-subtabs" style={{ marginBottom: 12 }}>
                      <button className={`cr-subtab ${detailTab === 'details' ? 'cr-subtab-active' : ''}`} onClick={() => setDetailTab('details')}>Details</button>
                      <button className={`cr-subtab ${detailTab === 'optimizer' ? 'cr-subtab-active' : ''}`} onClick={() => setDetailTab('optimizer')}>
                        <Zap size={11} /> Optimizer
                      </button>
                    </div>

                    {detailTab === 'optimizer' && (
                      <CampaignOptimizer campaign={c} onUpdateCampaign={handleUpdateCampaign} />
                    )}

                    {detailTab === 'details' && (<>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Products</div>
                    <div className="cm-chip-list" style={{ marginBottom: 10 }}>
                      {products.filter(p => c.productIds.includes(p.id)).map(p => <span key={p.id} className="cm-chip cm-chip-active">{p.name}</span>)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Communities</div>
                    <div className="cm-chip-list" style={{ marginBottom: 10 }}>
                      {communities.filter(cm => c.communityIds.includes(cm.id)).map(cm => (
                        <span key={cm.id} className="cm-chip cm-chip-active"><span className={`platform-badge ${cm.platform.toLowerCase()}`} style={{ marginRight: 4 }}>{cm.platform}</span>{cm.name}</span>
                      ))}
                    </div>
                    {topPerf.length > 0 && (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Top Performers</div>
                        {topPerf.map(t => (
                          <div key={t.id} style={{ fontSize: 11, color: 'var(--muted)', padding: 4, background: 'var(--bg)', borderRadius: 4, marginBottom: 4 }}>
                            [{t.community}] {(t.content || '').slice(0, 80)}...
                          </div>
                        ))}
                      </>
                    )}
                    </>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Campaign History */}
      {completedCampaigns.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Campaign History</div>
          <div className="cm-history">
            {completedCampaigns.map(c => (
              <div key={c.id} className="cm-history-item">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(c.startDate)} — {formatDate(c.endDate)} · {c.goal}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{(c.posts || []).length} posts</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.communityIds.length} communities</span>
                  <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px' }} onClick={() => handleDelete(c.id)}><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeCampaigns.length === 0 && completedCampaigns.length === 0 && !showForm && (
        <div className="empty-state" style={{ padding: 32 }}>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>No campaigns yet. Create one to coordinate posting across products and communities.</p>
        </div>
      )}
    </div>
  );
}
