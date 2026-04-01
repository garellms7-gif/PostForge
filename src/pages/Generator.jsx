import { useState, useEffect } from 'react';
import { Sparkles, Copy, Save, RefreshCw } from 'lucide-react';
import { TONES, POST_TYPES, generatePost } from '../lib/generatePost';

export default function Generator() {
  const [communities, setCommunities] = useState([]);
  const [product, setProduct] = useState({});
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [tone, setTone] = useState('Casual');
  const [postType, setPostType] = useState('Launch Announcement');
  const [output, setOutput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const cData = localStorage.getItem('postforge_communities');
    if (cData) setCommunities(JSON.parse(cData));
    const pData = localStorage.getItem('postforge_product');
    if (pData) setProduct(JSON.parse(pData));
  }, []);

  const handleGenerate = () => {
    const community = communities.find(c => String(c.id) === String(selectedCommunity));
    setGenerating(true);
    setOutput('');
    setTimeout(() => {
      const post = generatePost(product, community, tone, postType);
      setOutput(post);
      setGenerating(false);
    }, 800);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToHistory = () => {
    const community = communities.find(c => String(c.id) === String(selectedCommunity));
    const entry = {
      id: Date.now(),
      content: output,
      tone,
      postType,
      community: community?.name || 'General',
      platform: community?.platform || '',
      date: new Date().toISOString(),
    };
    const history = JSON.parse(localStorage.getItem('postforge_history') || '[]');
    localStorage.setItem('postforge_history', JSON.stringify([entry, ...history]));
  };

  return (
    <div>
      <h1 className="page-title">Generator</h1>
      <p className="page-subtitle">Create engaging posts tailored to your communities.</p>

      <div className="card">
        <div className="card-title">Post Settings</div>
        <div className="generator-controls">
          <div className="form-group">
            <label className="form-label">Community</label>
            <select
              className="form-select"
              value={selectedCommunity}
              onChange={e => setSelectedCommunity(e.target.value)}
            >
              <option value="">General</option>
              {communities.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Post Type</label>
            <select
              className="form-select"
              value={postType}
              onChange={e => setPostType(e.target.value)}
            >
              {POST_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Tone</label>
          <div className="tone-chips">
            {TONES.map(t => (
              <button
                key={t}
                className={`tone-chip ${tone === t ? 'active' : ''}`}
                onClick={() => setTone(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? <span className="spinner" /> : <Sparkles size={16} />}
            {generating ? 'Generating...' : 'Generate Post'}
          </button>
        </div>
      </div>

      {output && (
        <div className="card">
          <div className="card-title">Generated Post</div>
          <div className="generated-output">{output}</div>
          <div className="output-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              <Copy size={14} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleSaveToHistory}>
              <Save size={14} />
              Save to History
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleGenerate}>
              <RefreshCw size={14} />
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
