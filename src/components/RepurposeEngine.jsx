import { useState } from 'react';
import { X, Copy, Clock, Check, Sparkles } from 'lucide-react';

function getCommunities() { return JSON.parse(localStorage.getItem('postforge_communities') || '[]'); }
function getQueue() { return JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]'); }
function saveQueue(q) { localStorage.setItem('postforge_approval_queue', JSON.stringify(q)); }

const PLATFORM_INSTRUCTIONS = {
  Discord: 'Rewrite for Discord: keep casual and conversational, add 2-3 relevant emoji, break into short paragraphs with line breaks. Keep it under 400 words.',
  LinkedIn: 'Rewrite for LinkedIn: professional tone, add an industry insight or lesson learned, use structured format with line breaks. Open with a hook. End with a question or call to engage.',
  Reddit: 'Rewrite for Reddit: conversational and authentic, remove ALL marketing language, no exclamation marks, no hype words. Make it fit subreddit culture — helpful, genuine, slightly self-deprecating. Add a question to spark discussion.',
  X: 'Rewrite for Twitter/X: MUST be under 280 characters. Make it punchy and direct. Add 1-2 relevant hashtags. No fluff.',
  Facebook: 'Rewrite for Facebook: friendly and personal, conversational tone, include a question to drive comments.',
  Slack: 'Rewrite for Slack: brief and direct, professional but friendly, no marketing language.',
  Other: 'Rewrite in a general community-friendly tone.',
};

async function repurposeForCommunity(originalContent, community) {
  const settings = JSON.parse(localStorage.getItem('postforge_settings') || '{}');
  const apiKey = settings.apiKey;
  const platform = community.platform || 'Other';
  const instruction = PLATFORM_INSTRUCTIONS[platform] || PLATFORM_INSTRUCTIONS.Other;
  const prompt = `${instruction}\n\nCommunity: "${community.name}" on ${platform}\n\nOriginal post:\n${originalContent}\n\nReturn ONLY the rewritten post text, no preamble.`;

  if (apiKey && apiKey.length > 10) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system: 'You are a post repurposing assistant. Rewrite posts for different platforms and communities.', messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.content?.[0]?.text || originalContent;
      }
    } catch { /* fall through */ }
  }

  // Heuristic fallback
  return heuristicRepurpose(originalContent, platform);
}

function heuristicRepurpose(content, platform) {
  if (platform === 'X') {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    let tweet = (sentences[0] || '').trim();
    if (tweet.length > 250) tweet = tweet.slice(0, 247) + '...';
    return tweet + ' #indiedev #buildinpublic';
  }
  if (platform === 'Discord') {
    return content.replace(/\. /g, '.\n\n').replace(/!+ /g, '! ').slice(0, 1500) + ' 🚀';
  }
  if (platform === 'LinkedIn') {
    const lines = content.split('\n').filter(l => l.trim());
    return lines[0] + '\n\n' + lines.slice(1).join('\n\n') + '\n\nWhat are your thoughts? 👇';
  }
  if (platform === 'Reddit') {
    return content.replace(/!+/g, '.').replace(/🚀|🔥|💥|⚡|🎉|🏆/g, '').replace(/\bcheck it out\b/gi, 'take a look if interested');
  }
  return content;
}

export default function RepurposeEngine({ post, onClose }) {
  const [communities] = useState(getCommunities());
  const [selected, setSelected] = useState(communities.map(c => c.id));
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [scheduled, setScheduled] = useState(false);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(i => i !== id) : [...s, id]);

  const handleRepurpose = async () => {
    const targets = communities.filter(c => selected.includes(c.id));
    if (targets.length === 0) return;
    setProcessing(true);
    setResults([]);
    const res = [];
    for (const comm of targets) {
      const content = await repurposeForCommunity(post.content, comm);
      res.push({ community: comm.name, communityId: comm.id, platform: comm.platform, content, editing: false });
      setResults([...res]);
    }
    setProcessing(false);
  };

  const handleCopy = (content, idx) => {
    navigator.clipboard.writeText(content);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEditContent = (idx, content) => {
    setResults(r => r.map((item, i) => i === idx ? { ...item, content } : item));
  };

  const handleScheduleAll = () => {
    const queue = getQueue();
    const now = Date.now();
    results.forEach((r, i) => {
      const scheduledAt = new Date(now + i * 2 * 3600000).toISOString();
      queue.push({
        id: now + Math.random() + i,
        community: r.community,
        communityId: r.communityId,
        platform: r.platform,
        content: r.content,
        status: 'pending',
        date: scheduledAt,
        repurposedFrom: post.date,
      });
    });
    saveQueue(queue);

    // Save repurposed versions to history
    const history = JSON.parse(localStorage.getItem('postforge_history') || '[]');
    for (const r of results) {
      history.unshift({
        id: Date.now() + Math.random(),
        content: r.content,
        tone: 'Repurposed',
        postType: post.postType || 'Show & Tell',
        community: r.community,
        platform: r.platform,
        date: new Date().toISOString(),
        repurposedFrom: post.date,
      });
    }
    localStorage.setItem('postforge_history', JSON.stringify(history));
    setScheduled(true);
  };

  const handleSaveToHistory = (r) => {
    const history = JSON.parse(localStorage.getItem('postforge_history') || '[]');
    history.unshift({
      id: Date.now() + Math.random(),
      content: r.content,
      tone: 'Repurposed',
      postType: post.postType || 'Show & Tell',
      community: r.community,
      platform: r.platform,
      date: new Date().toISOString(),
      repurposedFrom: post.date,
    });
    localStorage.setItem('postforge_history', JSON.stringify(history));
  };

  return (
    <div className="rp-overlay" onClick={onClose}>
      <div className="rp-panel" onClick={e => e.stopPropagation()}>
        <div className="rp-header">
          <div className="rp-title">Repurpose Post</div>
          <button className="pa-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Original post */}
        <div className="rp-original">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Original</div>
          <div className="rp-original-text">{post.content.slice(0, 300)}{post.content.length > 300 ? '...' : ''}</div>
        </div>

        {/* Community selector */}
        {results.length === 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Select communities</div>
            <div className="cm-chip-list" style={{ marginBottom: 12 }}>
              {communities.map(c => (
                <button key={c.id} className={`cm-chip ${selected.includes(c.id) ? 'cm-chip-active' : ''}`} onClick={() => toggle(c.id)}>
                  <span className={`platform-badge ${c.platform.toLowerCase()}`} style={{ marginRight: 4 }}>{c.platform}</span>{c.name}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              Each version will be rewritten for that platform's style and audience.
            </div>

            <button className="btn btn-primary" onClick={handleRepurpose} disabled={processing || selected.length === 0}>
              {processing ? <span className="spinner" /> : <Sparkles size={15} />}
              {processing ? `Repurposing... (${results.length}/${selected.length})` : `Repurpose for ${selected.length} communit${selected.length !== 1 ? 'ies' : 'y'}`}
            </button>
          </>
        )}

        {/* Results grid */}
        {results.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 10 }}>{results.length} version{results.length !== 1 ? 's' : ''} created</div>
            <div className="rp-grid">
              {results.map((r, i) => (
                <div key={i} className="rp-result-card">
                  <div className="rp-result-header">
                    <span className={`platform-badge ${r.platform.toLowerCase()}`}>{r.platform}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{r.community}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>{r.content.length} chars</span>
                  </div>
                  <textarea className="form-textarea rp-result-text" value={r.content} onChange={e => handleEditContent(i, e.target.value)} />
                  <div className="rp-result-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(r.content, i)}>
                      {copiedId === i ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleSaveToHistory(r)}>Save</button>
                  </div>
                </div>
              ))}
            </div>

            {!scheduled ? (
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleScheduleAll}>
                  <Clock size={14} /> Repurpose + Schedule (2h apart)
                </button>
                <button className="btn btn-secondary" onClick={() => setResults([])}>Start Over</button>
              </div>
            ) : (
              <div style={{ marginTop: 14, fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>
                <Check size={14} style={{ verticalAlign: '-2px' }} /> All {results.length} posts scheduled to queue, 2 hours apart!
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
