import { useState, useEffect } from 'react';
import { Plus, Trash2, Users, ChevronDown, ChevronUp } from 'lucide-react';

const PLATFORMS = ['Discord', 'Reddit', 'LinkedIn', 'X', 'Facebook', 'Slack', 'Other'];

const CREDENTIAL_FIELDS = {
  Discord: [{ key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...' }],
  LinkedIn: [{ key: 'accessToken', label: 'Access Token', placeholder: 'Your LinkedIn access token' }],
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

const BLOCK_KEYS = [
  { key: 'voiceSamples', label: 'Voice/Tone Samples' },
  { key: 'updateLog', label: 'Update Log' },
  { key: 'roadmap', label: 'Roadmap Teaser' },
  { key: 'offerCta', label: 'Offer / CTA' },
  { key: 'personalStory', label: 'Personal Story' },
  { key: 'socialProof', label: 'Social Proof' },
];

export default function Communities() {
  const [communities, setCommunities] = useState([]);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('Discord');
  const [expandedId, setExpandedId] = useState(null);

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
    save([...communities, {
      id: Date.now(),
      name: name.trim(),
      platform,
      credentials: {},
      autoPost: false,
      preferredTime: '09:00',
      blockOverrides: {},
    }]);
    setName('');
    setPlatform('Discord');
  };

  const handleDelete = (id) => {
    save(communities.filter(c => c.id !== id));
    if (expandedId === id) setExpandedId(null);
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

  const toggleBlockOverride = (communityId, blockKey) => {
    save(communities.map(c => {
      if (c.id !== communityId) return c;
      const overrides = { ...c.blockOverrides };
      if (overrides[blockKey] === undefined) {
        // First click: explicitly disable (override to off)
        overrides[blockKey] = false;
      } else if (overrides[blockKey] === false) {
        // Second click: explicitly enable (override to on)
        overrides[blockKey] = true;
      } else {
        // Third click: remove override (use global default)
        delete overrides[blockKey];
      }
      return { ...c, blockOverrides: overrides };
    }));
  };

  const credentialFields = CREDENTIAL_FIELDS;

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
              const fields = credentialFields[c.platform] || [];
              const hasSettings = fields.length > 0 || true; // always show for block overrides
              return (
                <div key={c.id} className="community-card">
                  <div className="community-item" style={{ borderRadius: isExpanded ? '8px 8px 0 0' : undefined }}>
                    <div className="community-info">
                      <span className={`platform-badge ${c.platform.toLowerCase()}`}>
                        {c.platform}
                      </span>
                      <span className="community-name">{c.name}</span>
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
                      {fields.length > 0 && (
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
                          <div className="form-group">
                            <label className="form-label">Preferred Post Time</label>
                            <input
                              className="form-input"
                              type="time"
                              value={c.preferredTime || '09:00'}
                              onChange={e => updateCommunity(c.id, { preferredTime: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {/* Block Overrides */}
                      <div className="block-overrides-section">
                        <div className="form-label" style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                          Block Overrides
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                          Click to cycle: Global default → Off → On → Global default
                        </p>
                        <div className="block-override-grid">
                          {BLOCK_KEYS.map(b => {
                            const override = c.blockOverrides?.[b.key];
                            let stateLabel = 'Global';
                            let stateClass = 'override-global';
                            if (override === false) { stateLabel = 'Off'; stateClass = 'override-off'; }
                            if (override === true) { stateLabel = 'On'; stateClass = 'override-on'; }
                            return (
                              <button
                                key={b.key}
                                className={`block-override-chip ${stateClass}`}
                                onClick={() => toggleBlockOverride(c.id, b.key)}
                              >
                                <span className="block-override-name">{b.label}</span>
                                <span className="block-override-state">{stateLabel}</span>
                              </button>
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
            <p>No communities added yet. Add one above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
