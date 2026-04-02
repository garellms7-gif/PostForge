import { useState, useEffect } from 'react';
import { Sparkles, Copy, Save, RefreshCw, Star, AlertTriangle, FlaskConical, Eye, EyeOff } from 'lucide-react';
import { TONES, POST_TYPES, generatePost, resolveActiveBlocks } from '../lib/generatePost';
import { getCommunityHealth, daysSinceLastPost, setLastPostDate } from '../lib/health';
import { CharCounter, PlatformPreview } from '../components/UxHelpers';
import PostScorer, { OverallScoreBadge } from '../components/PostScorer';
import { scorePost } from '../lib/scorer';
import RewriteAssistant from '../components/RewriteAssistant';
import PromptBuilder, { getCustomPromptConfig, DEFAULT_SYSTEM_PROMPT } from '../components/PromptBuilder';

function getTopPosts() {
  return JSON.parse(localStorage.getItem('postforge_top_posts') || '[]');
}

function getTopPostsForCommunity(communityName) {
  if (!communityName) return [];
  return getTopPosts().filter(p => p.community === communityName).slice(0, 3);
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

function resolvePromptVariables(promptTemplate, product, community, tone, postType) {
  const voiceData = JSON.parse(localStorage.getItem('postforge_voice') || '{}');
  const blocks = JSON.parse(localStorage.getItem('postforge_blocks') || '{}');
  const samples = (voiceData.samples || []).filter(s => s.trim().length > 20);
  const voiceSamplesText = samples.length > 0 ? samples.slice(0, 3).map((s, i) => `Example ${i + 1}: ${s.slice(0, 300)}`).join('\n') : '';
  const updateLogText = blocks.updateLog?.entries?.slice(0, 3).map(e => `${e.date}: ${e.change}`).join('\n') || '';
  const roadmapText = blocks.roadmap?.items?.slice(0, 3).map(i => `${i.feature} (${i.status})`).join('\n') || '';

  return promptTemplate
    .replace(/\{\{product_name\}\}/g, product?.name || 'My Product')
    .replace(/\{\{tagline\}\}/g, product?.tagline || '')
    .replace(/\{\{description\}\}/g, product?.description || '')
    .replace(/\{\{price\}\}/g, product?.price || '')
    .replace(/\{\{gumroad_link\}\}/g, product?.gumroadLink || '')
    .replace(/\{\{community_name\}\}/g, community?.name || 'the community')
    .replace(/\{\{platform\}\}/g, community?.platform || '')
    .replace(/\{\{tone\}\}/g, tone || 'Casual')
    .replace(/\{\{post_type\}\}/g, postType || '')
    .replace(/\{\{voice_samples\}\}/g, voiceSamplesText)
    .replace(/\{\{update_log\}\}/g, updateLogText)
    .replace(/\{\{roadmap\}\}/g, roadmapText);
}

function getVoiceContext() {
  const data = JSON.parse(localStorage.getItem('postforge_voice') || '{}');
  const profile = data.profile;
  const samples = (data.samples || []).filter(s => s.trim().length > 20);
  if (!profile && samples.length === 0) return '';

  let ctx = '';
  if (profile) {
    ctx += `\n\n[Voice Profile: ${profile.tone || 'Friendly'} tone, ${profile.formality || 'casual'} formality, ${profile.avg_sentence_length || 'medium'} sentences, ${profile.humor_level || 'medium'} humor.`;
    if (profile.writing_style_summary) ctx += ` ${profile.writing_style_summary}`;
    if (profile.common_phrases?.length) ctx += ` Uses phrases like: ${profile.common_phrases.join(', ')}.`;
    if (profile.avoid_phrases?.length) ctx += ` Avoids: ${profile.avoid_phrases.join(', ')}.`;
    ctx += ']';
  }
  if (samples.length > 0) {
    ctx += '\n\n[Write in a style matching these real examples from the author:]\n';
    ctx += samples.slice(0, 3).map((s, i) => `Example ${i + 1}: ${s.slice(0, 300)}`).join('\n');
  }
  return ctx;
}

function generateForCommunity(product, community, tone, postType, blocks) {
  const activeFlags = blocks ? resolveActiveBlocks(blocks, community) : {};
  let post = generatePost(product, community, tone, postType, blocks, activeFlags);
  // Inject voice context
  const voiceCtx = getVoiceContext();
  if (voiceCtx) post = voiceCtx + '\n\n' + post;
  const topPosts = getTopPostsForCommunity(community?.name || '');
  if (topPosts.length > 0) post += buildTopPostsSection(topPosts);
  return post;
}

function computeInsights(results) {
  if (results.length < 3) return null;
  const toneWins = {};
  for (const r of results) {
    const winnerTone = r.winner === 'A' ? r.toneA : r.toneB;
    toneWins[winnerTone] = (toneWins[winnerTone] || 0) + 1;
  }
  const sorted = Object.entries(toneWins).sort((a, b) => b[1] - a[1]);
  if (sorted.length < 2) return null;
  const [topTone, topCount] = sorted[0];
  const pct = Math.round((topCount / results.length) * 100);
  if (pct <= 55) return null;
  return `${topTone} tone posts outperform ${sorted[1][0]} tone posts ${pct}% of the time for your products`;
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
  const [savedMsg, setSavedMsg] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [scores, setScores] = useState(null);
  const [promptConfig, setPromptConfig] = useState(getCustomPromptConfig());

  // A/B Test state
  const [abMode, setAbMode] = useState(false);
  const [communityA, setCommunityA] = useState('');
  const [communityB, setCommunityB] = useState('');
  const [outputA, setOutputA] = useState('');
  const [outputB, setOutputB] = useState('');
  const [copiedA, setCopiedA] = useState(false);
  const [copiedB, setCopiedB] = useState(false);
  const [previewA, setPreviewA] = useState(false);
  const [previewB, setPreviewB] = useState(false);
  const [scoresA, setScoresA] = useState(null);
  const [scoresB, setScoresB] = useState(null);
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
    if (navPayload?.checkin) { setPostType('Tips & Value'); setTone('Casual'); }
  }, [navPayload]);

  const handleGenerate = () => {
    const community = communities.find(c => String(c.id) === String(selectedCommunity));
    const config = getCustomPromptConfig();
    setGenerating(true);
    setOutput('');
    setScores(null);
    setPreviewMode(false);

    // A/B prompt test: generate with both default and custom
    if (config.abPromptTest && config.enabled && !abMode) {
      setOutputA(''); setOutputB('');
      setScoresA(null); setScoresB(null);
      setTimeout(() => {
        const defaultPost = generateForCommunity(product, community, tone, postType, blocks);
        const customCtx = resolvePromptVariables(config.prompt, product, community, tone, postType);
        const customPost = customCtx + '\n\n---\n\n' + generateForCommunity(product, community, tone, postType, blocks);
        setOutputA(defaultPost);
        setOutputB(customPost);
        setGenerating(false);
        scorePost(defaultPost, community?.name, community?.platform).then(setScoresA).catch(() => {});
        scorePost(customPost, community?.name, community?.platform).then(setScoresB).catch(() => {});
      }, 800);
      return;
    }

    setTimeout(() => {
      let post = generateForCommunity(product, community, tone, postType, blocks);
      if (config.enabled && config.prompt) {
        const resolved = resolvePromptVariables(config.prompt, product, community, tone, postType);
        post = resolved + '\n\n---\n\n' + post;
      }
      setOutput(post);
      setGenerating(false);
      scorePost(post, community?.name || 'General', community?.platform || '').then(setScores).catch(() => {});
    }, 800);
  };

  const handleGenerateAB = () => {
    const commA = communities.find(c => String(c.id) === String(communityA));
    const commB = communities.find(c => String(c.id) === String(communityB));
    setGenerating(true);
    setOutputA(''); setOutputB(''); setVoted(null);
    setScoresA(null); setScoresB(null);
    setPreviewA(false); setPreviewB(false);
    setTimeout(() => {
      const postA = generateForCommunity(product, commA, tone, postType, blocks);
      const postB = generateForCommunity(product, commB, tone, postType, blocks);
      setOutputA(postA);
      setOutputB(postB);
      setGenerating(false);
      // Auto-score both
      scorePost(postA, commA?.name || 'A', commA?.platform || '').then(setScoresA).catch(() => {});
      scorePost(postB, commB?.name || 'B', commB?.platform || '').then(setScoresB).catch(() => {});
    }, 800);
  };

  const handleCopy = () => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const handleCopyAB = (text, side) => {
    navigator.clipboard.writeText(text);
    if (side === 'A') { setCopiedA(true); setTimeout(() => setCopiedA(false), 2000); }
    else { setCopiedB(true); setTimeout(() => setCopiedB(false), 2000); }
  };

  const handleSaveToHistory = () => {
    const community = communities.find(c => String(c.id) === String(selectedCommunity));
    const entry = { id: Date.now(), content: output, tone, postType, community: community?.name || 'General', platform: community?.platform || '', date: new Date().toISOString() };
    const history = JSON.parse(localStorage.getItem('postforge_history') || '[]');
    localStorage.setItem('postforge_history', JSON.stringify([entry, ...history]));
    const commName = community?.name;
    if (commName) { setLastPostDate(commName); const cData = localStorage.getItem('postforge_communities'); if (cData) setCommunities(JSON.parse(cData)); }
    setSavedMsg('Saved to History!');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const handleSaveAB = (content, side) => {
    const comm = communities.find(c => String(c.id) === String(side === 'A' ? communityA : communityB));
    const entry = { id: Date.now() + (side === 'B' ? 1 : 0), content, tone, postType, community: comm?.name || 'General', platform: comm?.platform || '', date: new Date().toISOString() };
    const history = JSON.parse(localStorage.getItem('postforge_history') || '[]');
    localStorage.setItem('postforge_history', JSON.stringify([entry, ...history]));
    if (comm?.name) setLastPostDate(comm.name);
    return true;
  };

  const handleVote = (winner) => {
    const commA = communities.find(c => String(c.id) === String(communityA));
    const commB = communities.find(c => String(c.id) === String(communityB));
    const result = { id: Date.now(), winner, communityA: commA?.name || 'A', communityB: commB?.name || 'B', toneA: tone, toneB: tone, postType, date: new Date().toISOString() };
    const updated = [result, ...abResults].slice(0, 200);
    saveABResults(updated); setAbResults(updated); setVoted(winner);
  };

  const selectedComm = communities.find(c => String(c.id) === String(selectedCommunity));
  const activeFlags = blocks ? resolveActiveBlocks(blocks, selectedComm) : {};
  const activeBlockNames = Object.entries(activeFlags).filter(([, v]) => v).map(([k]) => k);
  const communityName = selectedComm?.name || '';
  const topPostCount = getTopPostsForCommunity(communityName).length;
  const unhealthyCommunities = communities.map(c => ({ ...c, health: getCommunityHealth(c.name), days: daysSinceLastPost(c.name) })).filter(c => c.health === 'fading' || c.health === 'silent');
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

        {/* Prompt Builder */}
        <PromptBuilder onConfigChange={setPromptConfig} />

        <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          {!abMode ? (
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? <span className="spinner" /> : <Sparkles size={16} />}
              {generating ? 'Generating...' : (promptConfig.abPromptTest && promptConfig.enabled ? 'Generate A/B Prompt Test' : 'Generate Post')}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleGenerateAB} disabled={generating || !communityA || !communityB}>
              {generating ? <span className="spinner" /> : <FlaskConical size={16} />}
              {generating ? 'Generating...' : 'Generate A/B Test'}
            </button>
          )}
          <div className="toggle-wrapper" onClick={() => { setAbMode(!abMode); setOutputA(''); setOutputB(''); setOutput(''); setVoted(null); }} style={{ marginLeft: 4 }}>
            <div className={`toggle ${abMode ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
            <span className="toggle-label">A/B Test</span>
          </div>
        </div>
      </div>

      {/* Standard output */}
      {!abMode && output && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              Generated Post
              <OverallScoreBadge scores={scores} />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setPreviewMode(!previewMode)}>
              {previewMode ? <EyeOff size={14} /> : <Eye size={14} />}
              {previewMode ? 'Raw' : 'Preview'}
            </button>
          </div>
          {previewMode ? (
            <PlatformPreview content={output} platform={selectedComm?.platform || ''} visible />
          ) : (
            <div className="generated-output">{output}</div>
          )}
          <CharCounter text={output} />
          <PostScorer content={output} communityName={selectedComm?.name} platform={selectedComm?.platform} />
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
            {savedMsg && <span className="status-msg">{savedMsg}</span>}
          </div>
          <RewriteAssistant content={output} onRewrite={(text) => { setOutput(text); setScores(null); scorePost(text, selectedComm?.name, selectedComm?.platform).then(setScores).catch(() => {}); }} />
        </div>
      )}

      {/* A/B Prompt Test output (not community A/B) */}
      {!abMode && promptConfig.abPromptTest && promptConfig.enabled && (outputA || outputB) && !output && (
        <>
          <div className="ab-grid">
            <div className="ab-panel">
              <div className="ab-panel-header">
                <span className="ab-label ab-label-a">D</span>
                <span className="ab-community">Default Prompt</span>
                <OverallScoreBadge scores={scoresA} />
              </div>
              <div className="generated-output" style={{ minHeight: 100 }}>{outputA}</div>
              <CharCounter text={outputA} />
              <PostScorer content={outputA} communityName={selectedComm?.name} platform={selectedComm?.platform} />
            </div>
            <div className="ab-panel">
              <div className="ab-panel-header">
                <span className="ab-label ab-label-b">C</span>
                <span className="ab-community">Custom Prompt</span>
                <OverallScoreBadge scores={scoresB} />
              </div>
              <div className="generated-output" style={{ minHeight: 100 }}>{outputB}</div>
              <CharCounter text={outputB} />
              <PostScorer content={outputB} communityName={selectedComm?.name} platform={selectedComm?.platform} />
            </div>
          </div>
        </>
      )}

      {/* A/B Community Test output */}
      {abMode && (outputA || outputB) && (
        <>
          <div className="ab-grid">
            {[{ label: 'A', labelClass: 'ab-label-a', comm: commAObj, out: outputA, copiedSide: copiedA, preview: previewA, setPreview: setPreviewA, side: 'A', sc: scoresA },
              { label: 'B', labelClass: 'ab-label-b', comm: commBObj, out: outputB, copiedSide: copiedB, preview: previewB, setPreview: setPreviewB, side: 'B', sc: scoresB }
            ].map(s => (
              <div key={s.side} className="ab-panel">
                <div className="ab-panel-header">
                  <span className={`ab-label ${s.labelClass}`}>{s.label}</span>
                  <span className="ab-community">{s.comm?.name || `Community ${s.label}`}</span>
                  {s.comm?.platform && <span className={`platform-badge ${s.comm.platform.toLowerCase()}`}>{s.comm.platform}</span>}
                  <OverallScoreBadge scores={s.sc} />
                  <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', padding: '3px 8px' }} onClick={() => s.setPreview(!s.preview)}>
                    {s.preview ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                {s.preview ? (
                  <PlatformPreview content={s.out} platform={s.comm?.platform || ''} visible />
                ) : (
                  <div className="generated-output" style={{ minHeight: 100 }}>{s.out}</div>
                )}
                <CharCounter text={s.out} />
                <PostScorer content={s.out} communityName={s.comm?.name} platform={s.comm?.platform} />
                <div className="output-actions" style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleCopyAB(s.out, s.side)}>
                    <Copy size={14} /> {s.copiedSide ? 'Copied!' : 'Copy'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSaveAB(s.out, s.side)}>
                    <Save size={14} /> Save
                  </button>
                </div>
                <RewriteAssistant content={s.out} onRewrite={(text) => {
                  if (s.side === 'A') { setOutputA(text); setScoresA(null); scorePost(text, s.comm?.name, s.comm?.platform).then(setScoresA).catch(() => {}); }
                  else { setOutputB(text); setScoresB(null); scorePost(text, s.comm?.name, s.comm?.platform).then(setScoresB).catch(() => {}); }
                }} />
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Which angle will you run with?</div>
            {!voted ? (
              <div className="ab-vote-row">
                <button className="btn btn-primary" onClick={() => handleVote('A')}>
                  <span className="ab-label ab-label-a" style={{ fontSize: 12, padding: '1px 8px' }}>A</span> A landed better
                </button>
                <span style={{ color: 'var(--muted)', fontSize: 14 }}>or</span>
                <button className="btn btn-primary" onClick={() => handleVote('B')}>
                  <span className="ab-label ab-label-b" style={{ fontSize: 12, padding: '1px 8px' }}>B</span> B landed better
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--success)', fontWeight: 500 }}>Voted for {voted}! Result saved.</p>
            )}
            {abResults.length > 0 && (
              <div className="ab-tally">
                <div className="ab-tally-row"><span className="ab-tally-label">Angle A wins</span><div className="ab-tally-bar-wrap"><div className="ab-tally-bar ab-bar-a" style={{ width: `${(aWins / (aWins + bWins || 1)) * 100}%` }} /></div><span className="ab-tally-count">{aWins}</span></div>
                <div className="ab-tally-row"><span className="ab-tally-label">Angle B wins</span><div className="ab-tally-bar-wrap"><div className="ab-tally-bar ab-bar-b" style={{ width: `${(bWins / (aWins + bWins || 1)) * 100}%` }} /></div><span className="ab-tally-count">{bWins}</span></div>
              </div>
            )}
            {insight && <div className="ab-insight"><Sparkles size={14} />{insight}</div>}
          </div>
        </>
      )}
    </div>
  );
}
