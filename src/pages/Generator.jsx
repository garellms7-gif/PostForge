import { useState, useEffect } from 'react';
import { Sparkles, Copy, Save, RefreshCw, Star, AlertTriangle, FlaskConical } from 'lucide-react';
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

function getABResults() {
  return JSON.parse(localStorage.getItem('postforge_ab_results') || '[]');
}

function saveABResults(results) {
  localStorage.setItem('postforge_ab_results', JSON.stringify(results));
}

function generateForCommunity(product, community, tone, postType, blocks) {
  const activeFlags = blocks ? resolveActiveBlocks(blocks, community) : {};
  let post = generatePost(product, community, tone, postType, blocks, activeFlags);
  const communityName = community?.name || '';
  const topPosts = getTopPostsForCommunity(communityName);
  if (topPosts.length > 0) {
    post += buildTopPostsSection(topPosts);
  }
  return post;
}

function computeInsights(results) {
  if (results.length < 3) return null;
  // Count wins by tone
  const toneWins = {};
  for (const r of results) {
    const winnerTone = r.winner === 'A' ? r.toneA : r.toneB;
    toneWins[winnerTone] = (toneWins[winnerTone] || 0) + 1;
  }
  const sorted = Object.entries(toneWins).sort((a, b) => b[1] - a[1]);
  if (sorted.length < 2) return null;
  const [topTone, topCount] = sorted[0];
  const total = results.length;
  const pct = Math.round((topCount / total) * 100);
  if (pct <= 55) return null;
  const [secondTone] = sorted[1];
  return `${topTone} tone posts outperform ${secondTone} tone posts ${pct}% of the time for your products`;
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

  // A/B Test state
  const [abMode, setAbMode] = useState(false);
  const [communityA, setCommunityA] = useState('');
  const [communityB, setCommunityB] = useState('');
  const [outputA, setOutputA] = useState('');
  const [outputB, setOutputB] = useState('');
  const [copiedA, setCopiedA] = useState(false);
  const [copiedB, setCopiedB] = useState(false);
  const [voted, setVoted] = useState(null);
  const [abResults, setAbResults] = useState([]);

  useEffect(() => {
    const cData = localStorage.getItem('postforge_communities');
    const loadedCommunities = cData ? JSON.parse(cData) : [];
    setCommunities(loadedCommunities);
    const pData = localStorage.getItem('postforge_product');
    if (pData) setProduct(JSON.parse(pData));
    const bData = localStorage.getItem('postforge_blocks');
    if (bData) setBlocks(JSON.parse(bData));
    setAbResults(getABResults());

    if (navPayload?.communityName && loadedCommunities.length > 0) {
      const match = loadedCommunities.find(c => c.name === navPayload.communityName);
      if (match) setSelectedCommunity(String(match.id));
    }
    if (navPayload?.checkin) {
      setPostType('Tips & Value');
      setTone('Casual');
    }
  }, [navPayload]);

  // Standard generate
  const handleGenerate = () => {
    const community = communities.find(c => String(c.id) === String(selectedCommunity));
    setGenerating(true);
    setOutput('');
    setTimeout(() => {
      setOutput(generateForCommunity(product, community, tone, postType, blocks));
      setGenerating(false);
    }, 800);
  };

  // A/B generate
  const handleGenerateAB = () => {
    const commA = communities.find(c => String(c.id) === String(communityA));
    const commB = communities.find(c => String(c.id) === String(communityB));
    setGenerating(true);
    setOutputA('');
    setOutputB('');
    setVoted(null);
    setTimeout(() => {
      setOutputA(generateForCommunity(product, commA, tone, postType, blocks));
      setOutputB(generateForCommunity(product, commB, tone, postType, blocks));
      setGenerating(false);
    }, 800);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAB = (text, side) => {
    navigator.clipboard.writeText(text);
    if (side === 'A') { setCopiedA(true); setTimeout(() => setCopiedA(false), 2000); }
    else { setCopiedB(true); setTimeout(() => setCopiedB(false), 2000); }
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
    const commName = community?.name;
    if (commName) {
      setLastPostDate(commName);
      const cData = localStorage.getItem('postforge_communities');
      if (cData) setCommunities(JSON.parse(cData));
    }
  };

  const handleSaveAB = (content, side) => {
    const comm = communities.find(c => String(c.id) === String(side === 'A' ? communityA : communityB));
    const entry = {
      id: Date.now() + (side === 'B' ? 1 : 0),
      content,
      tone,
      postType,
      community: comm?.name || 'General',
      platform: comm?.platform || '',
      date: new Date().toISOString(),
    };
    const history = JSON.parse(localStorage.getItem('postforge_history') || '[]');
    localStorage.setItem('postforge_history', JSON.stringify([entry, ...history]));
    if (comm?.name) setLastPostDate(comm.name);
  };

  const handleVote = (winner) => {
    const commA = communities.find(c => String(c.id) === String(communityA));
    const commB = communities.find(c => String(c.id) === String(communityB));
    const result = {
      id: Date.now(),
      winner,
      communityA: commA?.name || 'A',
      communityB: commB?.name || 'B',
      toneA: tone,
      toneB: tone,
      postType,
      date: new Date().toISOString(),
    };
    const updated = [result, ...abResults].slice(0, 200);
    saveABResults(updated);
    setAbResults(updated);
    setVoted(winner);
  };

  // Compute stats
  const selectedComm = communities.find(c => String(c.id) === String(selectedCommunity));
  const activeFlags = blocks ? resolveActiveBlocks(blocks, selectedComm) : {};
  const activeBlockNames = Object.entries(activeFlags).filter(([, v]) => v).map(([k]) => k);
  const communityName = selectedComm?.name || '';
  const topPostCount = getTopPostsForCommunity(communityName).length;

  const unhealthyCommunities = communities
    .map(c => ({ ...c, health: getCommunityHealth(c.name), days: daysSinceLastPost(c.name) }))
    .filter(c => c.health === 'fading' || c.health === 'silent');

  // A/B tally
  const aWins = abResults.filter(r => r.winner === 'A').length;
  const bWins = abResults.filter(r => r.winner === 'B').length;
  const insight = computeInsights(abResults);

  const commAObj = communities.find(c => String(c.id) === String(communityA));
  const commBObj = communities.find(c => String(c.id) === String(communityB));

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
          {!abMode ? (
            <div className="form-group">
              <label className="form-label">Community</label>
              <select className="form-select" value={selectedCommunity} onChange={e => setSelectedCommunity(e.target.value)}>
                <option value="">General</option>
                {communities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>)}
              </select>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Community A</label>
                <select className="form-select" value={communityA} onChange={e => setCommunityA(e.target.value)}>
                  <option value="">Select...</option>
                  {communities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Community B</label>
                <select className="form-select" value={communityB} onChange={e => setCommunityB(e.target.value)}>
                  <option value="">Select...</option>
                  {communities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>)}
                </select>
              </div>
            </>
          )}
          <div className="form-group">
            <label className="form-label">Post Type</label>
            <select className="form-select" value={postType} onChange={e => setPostType(e.target.value)}>
              {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Tone</label>
          <div className="tone-chips">
            {TONES.map(t => (
              <button key={t} className={`tone-chip ${tone === t ? 'active' : ''}`} onClick={() => setTone(t)}>{t}</button>
            ))}
          </div>
        </div>

        {!abMode && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {activeBlockNames.length > 0 && (
              <div>
                <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Active Content Blocks</label>
                <div className="active-blocks-bar">
                  {activeBlockNames.map(k => {
                    const labels = { voiceSamples: 'Voice/Tone', updateLog: 'Update Log', roadmap: 'Roadmap', offerCta: 'CTA', personalStory: 'Story', socialProof: 'Social Proof' };
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
        )}

        <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          {!abMode ? (
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? <span className="spinner" /> : <Sparkles size={16} />}
              {generating ? 'Generating...' : 'Generate Post'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleGenerateAB} disabled={generating || !communityA || !communityB}>
              {generating ? <span className="spinner" /> : <FlaskConical size={16} />}
              {generating ? 'Generating...' : 'Generate A/B Test'}
            </button>
          )}

          <div className="toggle-wrapper" onClick={() => { setAbMode(!abMode); setOutputA(''); setOutputB(''); setOutput(''); setVoted(null); }} style={{ marginLeft: 4 }}>
            <div className={`toggle ${abMode ? 'toggle-on' : ''}`}>
              <div className="toggle-knob" />
            </div>
            <span className="toggle-label">A/B Test</span>
          </div>
        </div>
      </div>

      {/* Standard output */}
      {!abMode && output && (
        <div className="card">
          <div className="card-title">Generated Post</div>
          <div className="generated-output">{output}</div>
          <div className="output-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleSaveToHistory}>
              <Save size={14} /> Save to History
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleGenerate}>
              <RefreshCw size={14} /> Regenerate
            </button>
          </div>
        </div>
      )}

      {/* A/B Test output */}
      {abMode && (outputA || outputB) && (
        <>
          <div className="ab-grid">
            <div className="ab-panel">
              <div className="ab-panel-header">
                <span className="ab-label ab-label-a">A</span>
                <span className="ab-community">{commAObj?.name || 'Community A'}</span>
                {commAObj?.platform && <span className={`platform-badge ${commAObj.platform.toLowerCase()}`}>{commAObj.platform}</span>}
              </div>
              <div className="generated-output" style={{ minHeight: 100 }}>{outputA}</div>
              <div className="output-actions" style={{ marginTop: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleCopyAB(outputA, 'A')}>
                  <Copy size={14} /> {copiedA ? 'Copied!' : 'Copy'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleSaveAB(outputA, 'A')}>
                  <Save size={14} /> Save
                </button>
              </div>
            </div>
            <div className="ab-panel">
              <div className="ab-panel-header">
                <span className="ab-label ab-label-b">B</span>
                <span className="ab-community">{commBObj?.name || 'Community B'}</span>
                {commBObj?.platform && <span className={`platform-badge ${commBObj.platform.toLowerCase()}`}>{commBObj.platform}</span>}
              </div>
              <div className="generated-output" style={{ minHeight: 100 }}>{outputB}</div>
              <div className="output-actions" style={{ marginTop: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleCopyAB(outputB, 'B')}>
                  <Copy size={14} /> {copiedB ? 'Copied!' : 'Copy'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleSaveAB(outputB, 'B')}>
                  <Save size={14} /> Save
                </button>
              </div>
            </div>
          </div>

          {/* Voting */}
          <div className="card">
            <div className="card-title">Which angle will you run with?</div>
            {!voted ? (
              <div className="ab-vote-row">
                <button className="btn btn-primary" onClick={() => handleVote('A')}>
                  <span className="ab-label ab-label-a" style={{ fontSize: 12, padding: '1px 8px' }}>A</span>
                  A landed better
                </button>
                <span style={{ color: 'var(--muted)', fontSize: 14 }}>or</span>
                <button className="btn btn-primary" onClick={() => handleVote('B')}>
                  <span className="ab-label ab-label-b" style={{ fontSize: 12, padding: '1px 8px' }}>B</span>
                  B landed better
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--success)', fontWeight: 500 }}>
                Voted for {voted}! Result saved.
              </p>
            )}

            {abResults.length > 0 && (
              <div className="ab-tally">
                <div className="ab-tally-row">
                  <span className="ab-tally-label">Angle A wins</span>
                  <div className="ab-tally-bar-wrap">
                    <div className="ab-tally-bar ab-bar-a" style={{ width: `${(aWins / (aWins + bWins || 1)) * 100}%` }} />
                  </div>
                  <span className="ab-tally-count">{aWins}</span>
                </div>
                <div className="ab-tally-row">
                  <span className="ab-tally-label">Angle B wins</span>
                  <div className="ab-tally-bar-wrap">
                    <div className="ab-tally-bar ab-bar-b" style={{ width: `${(bWins / (aWins + bWins || 1)) * 100}%` }} />
                  </div>
                  <span className="ab-tally-count">{bWins}</span>
                </div>
              </div>
            )}

            {insight && (
              <div className="ab-insight">
                <Sparkles size={14} />
                {insight}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
