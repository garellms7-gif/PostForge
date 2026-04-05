import { useState, useEffect } from 'react';
import { Package, Mic, Plus, Trash2, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';

const EMPTY_PRODUCT = {
  name: '',
  tagline: '',
  description: '',
  price: '',
  gumroadLink: '',
  version: '',
};

const MAX_SAMPLES = 5;

export default function ProductHub() {
  const { product, setProduct, voiceSamples, setVoiceSamples } = useApp();
  const [tab, setTab] = useState('product');

  // Product form
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [productSaved, setProductSaved] = useState(false);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    setForm({ ...EMPTY_PRODUCT, ...(product || {}) });
  }, [product]);

  const handleField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'name' && value.trim()) setNameError(false);
  };

  const handleSaveProduct = () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    setProduct({ ...form });
    setProductSaved(true);
    setTimeout(() => setProductSaved(false), 2000);
  };

  // Voice samples
  const [samples, setSamples] = useState(['']);
  const [samplesSaved, setSamplesSaved] = useState(false);

  useEffect(() => {
    if (Array.isArray(voiceSamples) && voiceSamples.length > 0) {
      setSamples(voiceSamples);
    } else {
      setSamples(['']);
    }
  }, [voiceSamples]);

  const handleSampleChange = (i, value) => {
    setSamples(prev => prev.map((s, idx) => (idx === i ? value : s)));
  };

  const handleAddSample = () => {
    if (samples.length >= MAX_SAMPLES) return;
    setSamples(prev => [...prev, '']);
  };

  const handleRemoveSample = (i) => {
    setSamples(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length === 0 ? [''] : next;
    });
  };

  const handleSaveSamples = () => {
    const cleaned = samples.map(s => s.trim()).filter(Boolean);
    setVoiceSamples(cleaned);
    setSamplesSaved(true);
    setTimeout(() => setSamplesSaved(false), 2000);
  };

  const savedStyle = { color: '#10b981', fontSize: 13, fontWeight: 600 };

  return (
    <div>
      <h1 className="page-title">Product Hub</h1>

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === 'product' ? 'tab-active' : ''}`}
          onClick={() => setTab('product')}
        >
          <Package size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
          Product
        </button>
        <button
          className={`tab-btn ${tab === 'voice' ? 'tab-active' : ''}`}
          onClick={() => setTab('voice')}
        >
          <Mic size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
          My Voice
        </button>
      </div>

      {tab === 'product' && (
        <div className="card">
          <div className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">
                Product Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                className="form-input"
                type="text"
                value={form.name}
                onChange={e => handleField('name', e.target.value)}
                placeholder="My awesome product"
                style={nameError ? { borderColor: '#ef4444' } : undefined}
              />
              {nameError && (
                <span style={{ color: '#ef4444', fontSize: 12 }}>Product name is required</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Tagline</label>
              <input
                className="form-input"
                type="text"
                value={form.tagline}
                onChange={e => handleField('tagline', e.target.value)}
                placeholder="Short one-liner"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows={5}
                value={form.description}
                onChange={e => handleField('description', e.target.value)}
                placeholder="What does it do? Who is it for?"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Price</label>
              <input
                className="form-input"
                type="text"
                value={form.price}
                onChange={e => handleField('price', e.target.value)}
                placeholder="$29"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gumroad Link</label>
              <input
                className="form-input"
                type="url"
                value={form.gumroadLink}
                onChange={e => handleField('gumroadLink', e.target.value)}
                placeholder="https://gumroad.com/l/..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Version</label>
              <input
                className="form-input"
                type="text"
                value={form.version}
                onChange={e => handleField('version', e.target.value)}
                placeholder="1.0.0"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={handleSaveProduct}>
                <Save size={16} /> Save
              </button>
              {productSaved && <span style={savedStyle}>Saved!</span>}
            </div>
          </div>
        </div>
      )}

      {tab === 'voice' && (
        <div className="card">
          <label className="form-label" style={{ display: 'block', marginBottom: 16, fontSize: 14 }}>
            Paste your real posts so PostForge writes in your voice
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {samples.map((sample, i) => (
              <div key={i} className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="form-label">Sample {i + 1}</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleRemoveSample(i)}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={sample}
                  onChange={e => handleSampleChange(i, e.target.value)}
                  placeholder="Paste one of your real posts here..."
                />
                <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
                  {sample.length} characters
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
            <button
              className="btn btn-secondary"
              onClick={handleAddSample}
              disabled={samples.length >= MAX_SAMPLES}
            >
              <Plus size={16} /> Add Sample
            </button>
            <button className="btn btn-primary" onClick={handleSaveSamples}>
              <Save size={16} /> Save Samples
            </button>
            {samplesSaved && <span style={savedStyle}>Saved!</span>}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
              {samples.length} / {MAX_SAMPLES}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
