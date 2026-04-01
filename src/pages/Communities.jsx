import { useState, useEffect } from 'react';
import { Plus, Trash2, Users, ChevronDown, ChevronUp, Zap, HelpCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { getCommunityHealth, daysSinceLastPost } from '../lib/health';
import { testDiscordWebhook, testLinkedInToken } from '../lib/posting';
import { UndoToast } from '../components/UxHelpers';

const PLATFORMS = ['Discord', 'Reddit', 'LinkedIn', 'X', 'Facebook', 'Slack', 'Other'];

const CREDENTIAL_FIELDS = {
  Reddit: [
    { key: 'subreddit', label: 'Subreddit', placeholder: 'e.g. indiehackers' },
    { key: 'username', label: 'Username', placeholder: 'Reddit username' },
    { key: 'password', label: 'Password', placeholder: 'Reddit password', type: 'password' },
    { key: 'appId', label: 'App ID', placeholder: 'Reddit app client ID' },
    { key: 'appSecret', label: 'App Secret', placeholder: 'Reddit app secret', type: 'password' },
  ],
  X: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Twitter API key' },
    { key: 'apiSecret', label: 'API Secret', placeholder: 'Twitter API secret', type: 'password' },
    { key: 'accessToken', label: 'Access Token', placeholder: 'OAuth access token' },
    { key: 'accessTokenSecret', label: 'Access Token Secret', placeholder: 'OAuth access token secret', type: 'password' },
  ],
};

const BLOCK_DEFS = [
  { key: 'voiceSamples', label: 'Voice/Tone Samples' },
  { key: 'updateLog', label: 'Update Log' },
  { key: 'roadmap', label: 'Roadmap Teaser' },
  { key: 'offerCta', label: 'Offer / CTA' },
  { key: 'personalStory', label: 'Personal Story' },
  { key: 'socialProof', label: 'Social Proof' },
];

function getGlobalBlockDefaults() {
  const data = localStorage.getItem('postforge_blocks');
  if (!data) return {};
  const blocks = JSON.parse(data);
  const defaults = {};
  for (const b of BLOCK_DEFS) defaults[b.key] = blocks[b.key]?.enabled || false;
  return defaults;
}

function DiscordSetup({ community, onUpdateCredential }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const webhookUrl = community.credentials?.webhookUrl || '';

  const handleTest = async () => {
    if (!webhookUrl.trim()) {
      setTestResult({ ok: false, msg: 'Enter a webhook URL first' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      await testDiscordWebhook(webhookUrl);
      setTestResult({ ok: true, msg: 'Connected!' });
    } catch (err) {
      setTestResult({ ok: false, msg: `Failed — ${err.message}` });
    }
    setTesting(false);
  };

  return (
    <div className="discord-setup">
      <div className="form-label" style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="16" height="12" viewBox="0 0 71 55" fill="currentColor" style={{ color: '#5865f2' }}>
          <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.7 58.7 0 0017.7 9a.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.6 38.6 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.8 41.8 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.3 36.3 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1A58.5 58.5 0 0070.4 45.6v-.1c1.4-15-2.3-28-9.8-39.6a.2.2 0 00-.1 0zM23.7 37.3c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7zm23.2 0c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7z"/>
        </svg>
        Discord Setup
      </div>

      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label">Webhook URL</label>
        <input
          className="form-input"
          placeholder="https://discord.com/api/webhooks/..."
          value={webhookUrl}
          onChange={e => onUpdateCredential(community.id, 'webhookUrl', e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={handleTest} disabled={testing}>
          {testing ? <span className="spinner" /> : <Zap size={14} />}
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {testResult && (
          <span style={{ fontSize: 13, fontWeight: 500, color: testResult.ok ? 'var(--success)' : 'var(--danger)' }}>
            {testResult.msg}
          </span>
        )}
      </div>

      {/* Discord Guide */}
      <button className="discord-guide-toggle" onClick={() => setGuideOpen(!guideOpen)}>
        <HelpCircle size={14} />
        {guideOpen ? 'Hide setup guide' : 'How to get a Discord webhook URL'}
        {guideOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {guideOpen && (
        <div className="discord-guide">
          <ol>
            <li>Open your Discord server</li>
            <li>Click the gear icon on any text channel</li>
            <li>Click <strong>Integrations</strong> then <strong>Webhooks</strong></li>
            <li>Click <strong>New Webhook</strong>, copy the URL</li>
            <li>Paste it in the field above</li>
          </ol>
          <a
            href="https://support.discord.com/hc/en-us/articles/228383668"
            target="_blank"
            rel="noopener noreferrer"
            className="discord-guide-link"
          >
            <ExternalLink size={12} />
            Discord webhook documentation
          </a>
        </div>
      )}
    </div>
  );
}

function LinkedInSetup({ community, onUpdateCredential }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const token = community.credentials?.accessToken || '';
  const tokenExpiry = community.credentials?.tokenExpiry || '';

  // Calculate days until expiry
  const daysUntilExpiry = tokenExpiry
    ? Math.ceil((new Date(tokenExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const expiryWarning = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  const expired = daysUntilExpiry !== null && daysUntilExpiry <= 0;

  const handleTest = async () => {
    if (!token.trim()) {
      setTestResult({ ok: false, msg: 'Enter an access token first' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testLinkedInToken(token);
      setTestResult({ ok: true, msg: `Connected as ${result.name}` });
    } catch (err) {
      setTestResult({ ok: false, msg: `Failed — ${err.message}` });
    }
    setTesting(false);
  };

  return (
    <div className="linkedin-setup">
      <div className="form-label" style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#0a66c2"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>
        LinkedIn Setup
      </div>

      {(expiryWarning || expired) && (
        <div className="linkedin-expiry-warning">
          <AlertTriangle size={14} />
          {expired
            ? `Your LinkedIn token for "${community.name}" has expired — update it to keep posting.`
            : `Your LinkedIn token for "${community.name}" expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} — update it to keep posting.`
          }
        </div>
      )}

      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label">Access Token</label>
        <input
          className="form-input"
          type="password"
          placeholder="Your LinkedIn access token"
          value={token}
          onChange={e => onUpdateCredential(community.id, 'accessToken', e.target.value)}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 12, maxWidth: 220 }}>
        <label className="form-label">Token expires on</label>
        <input
          className="form-input"
          type="date"
          value={tokenExpiry}
          onChange={e => onUpdateCredential(community.id, 'tokenExpiry', e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={handleTest} disabled={testing}>
          {testing ? <span className="spinner" /> : <Zap size={14} />}
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {testResult && (
          <span style={{ fontSize: 13, fontWeight: 500, color: testResult.ok ? 'var(--success)' : 'var(--danger)' }}>
            {testResult.msg}
          </span>
        )}
      </div>

      <button className="discord-guide-toggle" onClick={() => setGuideOpen(!guideOpen)}>
        <HelpCircle size={14} />
        {guideOpen ? 'Hide setup guide' : 'How to get your token'}
        {guideOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {guideOpen && (
        <div className="linkedin-guide">
          <ol>
            <li>Go to <a href="https://developer.linkedin.com" target="_blank" rel="noopener noreferrer">developer.linkedin.com</a></li>
            <li>Create an app (use <strong>PostForge</strong> as the name)</li>
            <li>Under <strong>Products</strong>, request <strong>"Share on LinkedIn"</strong></li>
            <li>Go to <strong>Auth</strong> tab, copy your Client ID and Client Secret</li>
            <li>Use LinkedIn OAuth 2.0 to generate an access token with scope <code>w_member_social</code></li>
            <li>Paste the token here — it lasts <strong>60 days</strong></li>
          </ol>
        </div>
      )}
    </div>
  );
}

export default function Communities() {
  const [communities, setCommunities] = useState([]);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('Discord');
  const [expandedId, setExpandedId] = useState(null);
  const [undoItem, setUndoItem] = useState(null);

  useEffect(() => {
    const data = localStorage.getItem('postforge_communities');
    if (data) setCommunities(JSON.parse(data));
  }, []);

  const save = (updated) => {
    setCommunities(updated);
    localStorage.setItem('postforge_communities', JSON.stringify(updated));
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    const defaults = getGlobalBlockDefaults();
    save([...communities, {
      id: Date.now(),
      name: name.trim(),
      platform,
      credentials: {},
      autoPost: false,
      preferredTime: '10:00',
      blockSettings: { ...defaults },
    }]);
    setName('');
    setPlatform('Discord');
  };

  const handleDelete = (id) => {
    const item = communities.find(c => c.id === id);
    const updated = communities.filter(c => c.id !== id);
    save(updated);
    if (expandedId === id) setExpandedId(null);
    setUndoItem(item);
  };

  const handleUndoDelete = () => {
    if (!undoItem) return;
    save([...communities, undoItem]);
    setUndoItem(null);
  };

  const updateCommunity = (id, updates) => {
    save(communities.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const updateCredential = (id, key, value) => {
    save(communities.map(c => {
      if (c.id !== id) return c;
      return { ...c, credentials: { ...c.credentials, [key]: value } };
    }));
  };

  const toggleBlock = (communityId, blockKey) => {
    save(communities.map(c => {
      if (c.id !== communityId) return c;
      const settings = { ...c.blockSettings };
      settings[blockKey] = !settings[blockKey];
      return { ...c, blockSettings: settings };
    }));
  };

  return (
    <div>
      <h1 className="page-title">Communities</h1>
      <p className="page-subtitle">Manage the communities you want to create posts for.</p>

      <div className="card">
        <div className="card-title">Add Community</div>
        <div className="inline-form">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              className="form-input"
              placeholder="e.g. Indie Hackers"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Platform</label>
            <select
              className="form-select"
              value={platform}
              onChange={e => setPlatform(e.target.value)}
            >
              {PLATFORMS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleAdd}>
            <Plus size={16} />
            Add
          </button>
        </div>

        {communities.length > 0 ? (
          <div className="community-list">
            {communities.map(c => {
              const isExpanded = expandedId === c.id;
              const fields = CREDENTIAL_FIELDS[c.platform] || [];
              const isDiscord = c.platform === 'Discord';
              const isLinkedIn = c.platform === 'LinkedIn';
              return (
                <div key={c.id} className="community-card">
                  <div className="community-item" style={{ borderRadius: isExpanded ? '8px 8px 0 0' : undefined }}>
                    <div className="community-info">
                      <span className={`platform-badge ${c.platform.toLowerCase()}`}>
                        {c.platform}
                      </span>
                      <span className="community-name">{c.name}</span>
                      {(() => {
                        const health = getCommunityHealth(c.name);
                        const days = daysSinceLastPost(c.name);
                        if (health === 'active') return <span className="health-badge health-active">Active</span>;
                        if (health === 'fading') return <span className="health-badge health-fading">Fading · {days}d</span>;
                        if (health === 'silent') return <span className="health-badge health-silent">Silent · {days}d</span>;
                        return <span className="health-badge health-none">No posts</span>;
                      })()}
                      <div className="toggle-wrapper" onClick={() => updateCommunity(c.id, { autoPost: !c.autoPost })}>
                        <div className={`toggle ${c.autoPost ? 'toggle-on' : ''}`}>
                          <div className="toggle-knob" />
                        </div>
                        <span className="toggle-label">{c.autoPost ? 'Auto-post on' : 'Auto-post off'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        Settings
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="community-settings">
                      {/* Discord-specific setup */}
                      {isDiscord && (
                        <div style={{ marginBottom: 20 }}>
                          <DiscordSetup community={c} onUpdateCredential={updateCredential} />
                        </div>
                      )}

                      {/* LinkedIn-specific setup */}
                      {isLinkedIn && (
                        <div style={{ marginBottom: 20 }}>
                          <LinkedInSetup community={c} onUpdateCredential={updateCredential} />
                        </div>
                      )}

                      {/* Other platform credential fields */}
                      {!isDiscord && !isLinkedIn && fields.length > 0 && (
                        <div className="form-grid" style={{ marginBottom: 20 }}>
                          {fields.map(f => (
                            <div className="form-group" key={f.key}>
                              <label className="form-label">{f.label}</label>
                              <input
                                className="form-input"
                                type={f.type || 'text'}
                                placeholder={f.placeholder}
                                value={c.credentials?.[f.key] || ''}
                                onChange={e => updateCredential(c.id, f.key, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Preferred time (all platforms) */}
                      <div className="form-group" style={{ maxWidth: 200, marginBottom: 20 }}>
                        <label className="form-label">Preferred Post Time</label>
                        <input
                          className="form-input"
                          type="time"
                          value={c.preferredTime || '10:00'}
                          onChange={e => updateCommunity(c.id, { preferredTime: e.target.value })}
                        />
                      </div>

                      {/* Block Overrides */}
                      <div className="block-settings-section">
                        <div className="form-label" style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                          Block Overrides
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                          Toggle which content blocks are included when generating posts for this community.
                        </p>
                        <div className="block-toggle-list">
                          {BLOCK_DEFS.map(b => {
                            const isOn = c.blockSettings?.[b.key] || false;
                            return (
                              <div key={b.key} className="block-toggle-row">
                                <span className="block-toggle-name">{b.label}</span>
                                <div className="toggle-wrapper" onClick={() => toggleBlock(c.id, b.key)}>
                                  <div className={`toggle ${isOn ? 'toggle-on' : ''}`}>
                                    <div className="toggle-knob" />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Users size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>No communities added yet.</p>
            <p style={{ marginTop: 8, fontSize: 13 }}>Use the form above to add your first community — Discord, Reddit, LinkedIn, or any platform.</p>
          </div>
        )}
      </div>

      {undoItem && (
        <UndoToast
          key={undoItem.id}
          message={`"${undoItem.name}" deleted`}
          onUndo={handleUndoDelete}
        />
      )}
    </div>
  );
}
