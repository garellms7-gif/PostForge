import { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';

const EMPTY_PRODUCT = {
  name: '',
  tagline: '',
  description: '',
  price: '',
  gumroadLink: '',
  version: '',
};

const EMPTY_BLOCKS = {
  voiceSamples: { enabled: false, samples: ['', '', '', '', ''] },
  updateLog: { enabled: false, entries: [] },
  roadmap: { enabled: false, items: [] },
  offerCta: { enabled: false, ctaText: '', url: '', buttonLabel: '' },
  personalStory: { enabled: false, story: '' },
  socialProof: { enabled: false, entries: [] },
};

function BlockToggle({ label, hint, enabled, onToggle, children }) {
  return (
    <div className="content-block">
      <div className="content-block-header">
        <div>
          <div className="content-block-title">{label}</div>
          {hint && <div className="content-block-hint">{hint}</div>}
        </div>
        <div className="toggle-wrapper" onClick={onToggle}>
          <div className={`toggle ${enabled ? 'toggle-on' : ''}`}>
            <div className="toggle-knob" />
          </div>
        </div>
      </div>
      {enabled && <div className="content-block-body">{children}</div>}
    </div>
  );
}

export default function ProductHub() {
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [blocks, setBlocks] = useState(EMPTY_BLOCKS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem('postforge_product');
    if (data) setProduct(JSON.parse(data));
    const bData = localStorage.getItem('postforge_blocks');
    if (bData) setBlocks({ ...EMPTY_BLOCKS, ...JSON.parse(bData) });
  }, []);

  const update = (field, value) => {
    setProduct(prev => ({ ...prev, [field]: value }));
  };

  const updateBlock = (blockKey, updates) => {
    setBlocks(prev => ({ ...prev, [blockKey]: { ...prev[blockKey], ...updates } }));
  };

  const handleSave = () => {
    localStorage.setItem('postforge_product', JSON.stringify(product));
    localStorage.setItem('postforge_blocks', JSON.stringify(blocks));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Update log helpers
  const [newLogDate, setNewLogDate] = useState('');
  const [newLogChange, setNewLogChange] = useState('');
  const addLogEntry = () => {
    if (!newLogChange.trim()) return;
    const entry = { id: Date.now(), date: newLogDate || new Date().toISOString().split('T')[0], change: newLogChange.trim() };
    updateBlock('updateLog', { entries: [entry, ...blocks.updateLog.entries] });
    setNewLogDate('');
    setNewLogChange('');
  };
  const deleteLogEntry = (id) => {
    updateBlock('updateLog', { entries: blocks.updateLog.entries.filter(e => e.id !== id) });
  };

  // Roadmap helpers
  const [newFeature, setNewFeature] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [newStatus, setNewStatus] = useState('Planned');
  const addRoadmapItem = () => {
    if (!newFeature.trim()) return;
    const item = { id: Date.now(), feature: newFeature.trim(), targetDate: newTargetDate, status: newStatus };
    updateBlock('roadmap', { items: [...blocks.roadmap.items, item] });
    setNewFeature('');
    setNewTargetDate('');
    setNewStatus('Planned');
  };
  const deleteRoadmapItem = (id) => {
    updateBlock('roadmap', { items: blocks.roadmap.items.filter(i => i.id !== id) });
  };

  // Social proof helpers
  const [newProof, setNewProof] = useState('');
  const addProofEntry = () => {
    if (!newProof.trim()) return;
    const entry = { id: Date.now(), text: newProof.trim() };
    updateBlock('socialProof', { entries: [...blocks.socialProof.entries, entry] });
    setNewProof('');
  };
  const deleteProofEntry = (id) => {
    updateBlock('socialProof', { entries: blocks.socialProof.entries.filter(e => e.id !== id) });
  };

  return (
    <div>
      <h1 className="page-title">Product Hub</h1>
      <p className="page-subtitle">Define your product details for personalized post generation.</p>

      <div className="card">
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Product Name</label>
            <input className="form-input" placeholder="e.g. ShipFast" value={product.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tagline</label>
            <input className="form-input" placeholder="e.g. Ship your SaaS in days, not months" value={product.tagline} onChange={e => update('tagline', e.target.value)} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="Describe what your product does and who it's for..." value={product.description} onChange={e => update('description', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Price</label>
            <input className="form-input" placeholder="e.g. $49" value={product.price} onChange={e => update('price', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Gumroad Link</label>
            <input className="form-input" placeholder="e.g. https://you.gumroad.com/product" value={product.gumroadLink} onChange={e => update('gumroadLink', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Version</label>
            <input className="form-input" placeholder="e.g. 1.0.0" value={product.version} onChange={e => update('version', e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} />
            Save Product
          </button>
          {saved && <span className="status-msg">Saved!</span>}
        </div>
      </div>

      {/* Content Blocks */}
      <h2 className="section-title">Content Blocks</h2>
      <p className="page-subtitle" style={{ marginBottom: 20 }}>Toggle blocks on/off to customize what gets included in generated posts.</p>

      {/* 1. Voice/Tone Samples */}
      <BlockToggle
        label="Voice/Tone Samples"
        hint="PostForge will mimic this writing style"
        enabled={blocks.voiceSamples.enabled}
        onToggle={() => updateBlock('voiceSamples', { enabled: !blocks.voiceSamples.enabled })}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {blocks.voiceSamples.samples.map((s, i) => (
            <div className="form-group" key={i}>
              <label className="form-label">Sample {i + 1}</label>
              <textarea
                className="form-textarea"
                placeholder="Paste an example of your real writing..."
                style={{ minHeight: 60 }}
                value={s}
                onChange={e => {
                  const updated = [...blocks.voiceSamples.samples];
                  updated[i] = e.target.value;
                  updateBlock('voiceSamples', { samples: updated });
                }}
              />
            </div>
          ))}
        </div>
      </BlockToggle>

      {/* 2. Update Log */}
      <BlockToggle
        label="Update Log"
        hint="Include recent updates in posts"
        enabled={blocks.updateLog.enabled}
        onToggle={() => updateBlock('updateLog', { enabled: !blocks.updateLog.enabled })}
      >
        <div className="inline-form" style={{ marginBottom: 12 }}>
          <div className="form-group" style={{ flex: '0 0 140px' }}>
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={newLogDate} onChange={e => setNewLogDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">What changed</label>
            <input className="form-input" placeholder="e.g. Added dark mode support" value={newLogChange} onChange={e => setNewLogChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLogEntry()} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={addLogEntry}><Plus size={14} /> Add</button>
        </div>
        {blocks.updateLog.entries.map(e => (
          <div key={e.id} className="block-list-item">
            <div><span className="block-list-date">{e.date}</span> {e.change}</div>
            <button className="btn btn-danger btn-sm" onClick={() => deleteLogEntry(e.id)}><Trash2 size={12} /></button>
          </div>
        ))}
      </BlockToggle>

      {/* 3. Roadmap Teaser */}
      <BlockToggle
        label="Roadmap Teaser"
        hint="Tease upcoming features in posts"
        enabled={blocks.roadmap.enabled}
        onToggle={() => updateBlock('roadmap', { enabled: !blocks.roadmap.enabled })}
      >
        <div className="inline-form" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label">Feature name</label>
            <input className="form-input" placeholder="e.g. AI autofill" value={newFeature} onChange={e => setNewFeature(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRoadmapItem()} />
          </div>
          <div className="form-group" style={{ flex: '0 0 140px' }}>
            <label className="form-label">Target date</label>
            <input className="form-input" type="date" value={newTargetDate} onChange={e => setNewTargetDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '0 0 140px' }}>
            <label className="form-label">Status</label>
            <select className="form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              <option>Planned</option>
              <option>In Progress</option>
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={addRoadmapItem}><Plus size={14} /> Add</button>
        </div>
        {blocks.roadmap.items.map(item => (
          <div key={item.id} className="block-list-item">
            <div>
              <span className={`roadmap-status ${item.status === 'In Progress' ? 'in-progress' : 'planned'}`}>{item.status}</span>
              <span style={{ marginLeft: 8 }}>{item.feature}</span>
              {item.targetDate && <span className="block-list-date" style={{ marginLeft: 8 }}>{item.targetDate}</span>}
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => deleteRoadmapItem(item.id)}><Trash2 size={12} /></button>
          </div>
        ))}
      </BlockToggle>

      {/* 4. Offer/CTA */}
      <BlockToggle
        label="Offer / CTA"
        hint="Include a call to action in posts"
        enabled={blocks.offerCta.enabled}
        onToggle={() => updateBlock('offerCta', { enabled: !blocks.offerCta.enabled })}
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">CTA Text</label>
            <input className="form-input" placeholder='e.g. "Try it free"' value={blocks.offerCta.ctaText} onChange={e => updateBlock('offerCta', { ctaText: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">URL</label>
            <input className="form-input" placeholder="https://..." value={blocks.offerCta.url} onChange={e => updateBlock('offerCta', { url: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Button Label</label>
            <input className="form-input" placeholder="e.g. Get Started" value={blocks.offerCta.buttonLabel} onChange={e => updateBlock('offerCta', { buttonLabel: e.target.value })} />
          </div>
        </div>
      </BlockToggle>

      {/* 5. Personal Story */}
      <BlockToggle
        label="Personal Story"
        hint="Include your background in posts"
        enabled={blocks.personalStory.enabled}
        onToggle={() => updateBlock('personalStory', { enabled: !blocks.personalStory.enabled })}
      >
        <div className="form-group">
          <label className="form-label">Tell your story — who you are, where you started, why you built this</label>
          <textarea
            className="form-textarea"
            style={{ minHeight: 120 }}
            placeholder="I'm a solo developer who..."
            value={blocks.personalStory.story}
            onChange={e => updateBlock('personalStory', { story: e.target.value })}
          />
        </div>
      </BlockToggle>

      {/* 6. Social Proof */}
      <BlockToggle
        label="Social Proof"
        hint="Include wins and numbers in posts"
        enabled={blocks.socialProof.enabled}
        onToggle={() => updateBlock('socialProof', { enabled: !blocks.socialProof.enabled })}
      >
        <div className="inline-form" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label">Stat or win</label>
            <input className="form-input" placeholder='e.g. "500 users", "Featured on Product Hunt"' value={newProof} onChange={e => setNewProof(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProofEntry()} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={addProofEntry}><Plus size={14} /> Add</button>
        </div>
        {blocks.socialProof.entries.map(e => (
          <div key={e.id} className="block-list-item">
            <div>{e.text}</div>
            <button className="btn btn-danger btn-sm" onClick={() => deleteProofEntry(e.id)}><Trash2 size={12} /></button>
          </div>
        ))}
      </BlockToggle>

      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={16} />
          Save All
        </button>
        {saved && <span className="status-msg">Saved!</span>}
      </div>
    </div>
  );
}
