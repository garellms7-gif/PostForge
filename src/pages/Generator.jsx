import { useState, useEffect } from 'react';
import { Sparkles, Copy, Save, RefreshCw, Star, AlertTriangle } from 'lucide-react';
import { TONES, POST_TYPES, generatePost, resolveActiveBlocks } from '../lib/generatePost';
import { getCommunityHealth, daysSinceLastPost, setLastPostDate } from '../lib/health';

function getTopPosts() {
  return JSON.parse(localStorage.getItem('postforge_top_posts') || '[]');
}

function getTopPostsForCommunity(communityName) {
  if (!communityName) return [];
  return getTopPosts()
    .filter(p => p.community === communityName)
    .slice(0, 3);
}

function buildTopPostsSection(topPosts) {
  if (topPosts.length === 0) return '';
  const header = '\n\n---\n\nThese posts performed well with this community — write in a similar style and structure:\n';
  const examples = topPosts.map((p, i) => `[Example ${i + 1}]\n${p.content}`).join('\n\n');
  return header + '\n' + examples;
}

export default function Generator({ navPayload }) {
  const [communities, setCommunities] = useState([]);
  const [product, setProduct] = useState({});
  const [blocks, setBlocks] = useState(null);
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [tone, setTone] = useState('Casual');
  const [postType, setPostType] = useState('Launch Announcement');
  const [output, setOutput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const cData = localStorage.getItem('postforge_communities');
    const loadedCommunities = cData ? JSON.parse(cData) : [];
    setCommunities(loadedCommunities);
    const pData = localStorage.getItem('postforge_product');
    if (pData) setProduct(JSON.parse(pData));
    const bData = localStorage.getItem('postforge_blocks');
    if (bData) setBlocks(JSON.parse(bData));

    // Handle navPayload from "Use as Inspiration"
    if (navPayload?.communityName && loadedCommunities.length > 0) {
      const match = loadedCommunities.find(c => c.name === navPayload.communityName);
      if (match) {
        setSelectedCommunity(String(match.id));
      }
    }

    // Handle navPayload from burnout "Generate Check-in"
    if (navPayload?.checkin) {
      setPostType('Tips & Value');
      setTone('Casual');
    }
  }, [navPayload]);

  const handleGenerate = () => {
    const community = communities.find(c => String(c.id) === String(selectedCommunity));
    const activeFlags = blocks ? resolveActiveBlocks(blocks, community) : {};
    setGenerating(true);
    setOutput('');
    setTimeout(() => {
      let post = generatePost(product, community, tone, postType, blocks, activeFlags);
      // Append top-performing posts for this community as style reference
      const communityName = community?.name || '';
      const topPosts = getTopPostsForCommunity(communityName);
      if (topPosts.length > 0) {
        post += buildTopPostsSection(topPosts);
      }
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
    // Update community health tracking
    const commName = community?.name;
    if (commName) {
      setLastPostDate(commName);
      // Re-read communities so the warning banner updates
      const cData = localStorage.getItem('postforge_communities');
      if (cData) setCommunities(JSON.parse(cData));
    }
  };

  // Compute which blocks are active for the selected community
  const selectedComm = communities.find(c => String(c.id) === String(selectedCommunity));
  const activeFlags = blocks ? resolveActiveBlocks(blocks, selectedComm) : {};
  const activeBlockNames = Object.entries(activeFlags).filter(([, v]) => v).map(([k]) => k);

  // Show top posts count for selected community
  const communityName = selectedComm?.name || '';
  const topPostCount = getTopPostsForCommunity(communityName).length;

  // Compute unhealthy communities for warning banner
  const unhealthyCommunities = communities
    .map(c => {
      const health = getCommunityHealth(c.name);
      const days = daysSinceLastPost(c.name);
      return { ...c, health, days };
    })
    .filter(c => c.health === 'fading' || c.health === 'silent');

  return (
    <div>
      <h1 className="page-title">Generator</h1>
      <p className="page-subtitle">Create engaging posts tailored to your communities.</p>

      {unhealthyCommunities.length > 0 && (
        <div className="health-warning-banner">
          <AlertTriangle size={16} />
          <div>
            {unhealthyCommunities.map(c => (
              <div key={c.id} className="health-warning-line">
                You haven't posted to <strong>{c.name}</strong> in {c.days} days — audiences disengage after 10 days of silence.
              </div>
            ))}
          </div>
        </div>
      )}

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

        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {activeBlockNames.length > 0 && (
            <div>
              <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Active Content Blocks</label>
              <div className="active-blocks-bar">
                {activeBlockNames.map(k => {
                  const labels = {
                    voiceSamples: 'Voice/Tone',
                    updateLog: 'Update Log',
                    roadmap: 'Roadmap',
                    offerCta: 'CTA',
                    personalStory: 'Story',
                    socialProof: 'Social Proof',
                  };
                  return <span key={k} className="active-block-tag">{labels[k] || k}</span>;
                })}
              </div>
            </div>
          )}
          {topPostCount > 0 && (
            <div>
              <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Inspiration</label>
              <div className="active-blocks-bar">
                <span className="active-block-tag top-post-tag">
                  <Star size={10} fill="currentColor" /> {topPostCount} top post{topPostCount !== 1 ? 's' : ''} from {communityName}
                </span>
              </div>
            </div>
          )}
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
