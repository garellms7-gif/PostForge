import { useState, useEffect } from 'react';
import { Shield, Key, Clock, Trash2, AlertTriangle, Zap, Check, X, Lock } from 'lucide-react';
import { testDiscordWebhook, testLinkedInToken, testRedditConnection, testTwitterConnection, getTwitterUsage } from '../lib/posting';

const DEFAULT_SETTINGS = {
  burnoutEnabled: true,
  burnoutDays: 7,
  apiKey: '',
  defaultPostTime: '10:00',
};

function getSettings() {
  const data = localStorage.getItem('postforge_settings');
  return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  localStorage.setItem('postforge_settings', JSON.stringify(settings));
}

function getCommunities() {
  return JSON.parse(localStorage.getItem('postforge_communities') || '[]');
}

// Simple encryption: XOR with passphrase then base64
function encrypt(text, passphrase) {
  if (!text || !passphrase) return text;
  const result = [];
  for (let i = 0; i < text.length; i++) {
    result.push(text.charCodeAt(i) ^ passphrase.charCodeAt(i % passphrase.length));
  }
  return 'ENC:' + btoa(String.fromCharCode(...result));
}

function decrypt(text, passphrase) {
  if (!text || !passphrase || !text.startsWith('ENC:')) return text;
  try {
    const decoded = atob(text.slice(4));
    const result = [];
    for (let i = 0; i < decoded.length; i++) {
      result.push(decoded.charCodeAt(i) ^ passphrase.charCodeAt(i % passphrase.length));
    }
    return String.fromCharCode(...result);
  } catch {
    return text;
  }
}

function getPassphrase() {
  return sessionStorage.getItem('postforge_passphrase') || '';
}

function setPassphrase(p) {
  sessionStorage.setItem('postforge_passphrase', p);
}

// Encrypt all credential values for a community
function encryptCommunityCredentials(communities, passphrase) {
  if (!passphrase) return;
  const sensitiveKeys = ['webhookUrl', 'accessToken', 'tokenExpiry', 'password', 'appId', 'appSecret', 'apiKey', 'apiSecret', 'accessTokenSecret', 'username'];
  const updated = communities.map(c => {
    if (!c.credentials) return c;
    const creds = { ...c.credentials };
    for (const key of sensitiveKeys) {
      if (creds[key] && !creds[key].startsWith('ENC:')) {
        creds[key] = encrypt(creds[key], passphrase);
      }
    }
    return { ...c, credentials: creds };
  });
  localStorage.setItem('postforge_communities', JSON.stringify(updated));
}

function getCredentialStatus(community) {
  const p = community.platform;
  const c = community.credentials || {};
  const passphrase = getPassphrase();
  const val = (k) => {
    const v = c[k] || '';
    return passphrase && v.startsWith('ENC:') ? decrypt(v, passphrase) : v;
  };

  if (p === 'Discord') {
    if (val('webhookUrl')) return 'connected';
    return 'missing';
  }
  if (p === 'LinkedIn') {
    if (!val('accessToken')) return 'missing';
    const expiry = val('tokenExpiry');
    if (expiry) {
      const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
      if (days <= 0) return 'expired';
      if (days <= 7) return 'expiring';
    }
    return 'connected';
  }
  if (p === 'Reddit') {
    if (val('appId') && val('appSecret') && val('username') && val('password')) return 'connected';
    return 'missing';
  }
  if (p === 'X') {
    if (val('apiKey') && val('apiSecret') && val('accessToken') && val('accessTokenSecret')) {
      const usage = getTwitterUsage();
      if (usage.count >= 1200) return 'expiring'; // 80% of 1500
      return 'connected';
    }
    return 'missing';
  }
  return 'unknown';
}

function getStatusLabel(status) {
  if (status === 'connected') return { text: 'Connected', cls: 'cred-status-ok' };
  if (status === 'missing') return { text: 'Not set up', cls: 'cred-status-missing' };
  if (status === 'expiring') return { text: 'Expiring soon', cls: 'cred-status-warn' };
  if (status === 'expired') return { text: 'Expired', cls: 'cred-status-missing' };
  return { text: 'Unknown', cls: 'cred-status-missing' };
}

const PLATFORM_ICONS = {
  Discord: <svg width="16" height="12" viewBox="0 0 71 55" fill="#5865f2"><path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.7 58.7 0 0017.7 9a.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.6 38.6 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.8 41.8 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.3 36.3 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1A58.5 58.5 0 0070.4 45.6v-.1c1.4-15-2.3-28-9.8-39.6a.2.2 0 00-.1 0zM23.7 37.3c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7zm23.2 0c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7z"/></svg>,
  LinkedIn: <svg width="16" height="16" viewBox="0 0 24 24" fill="#0a66c2"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>,
  Reddit: <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff4500"><path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.1 3.1 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25 8 13.938 8.561 14.5 9.25 14.5s1.25-.562 1.25-1.25C10.5 12.562 9.939 12 9.25 12zm5.5 0c-.689 0-1.25.562-1.25 1.25 0 .688.561 1.25 1.25 1.25s1.25-.562 1.25-1.25c0-.688-.561-1.25-1.25-1.25zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 000-.463.327.327 0 00-.462 0c-.545.533-1.684.73-2.512.73-.828 0-1.953-.197-2.498-.73a.327.327 0 00-.219-.094z"/></svg>,
  X: <svg width="14" height="14" viewBox="0 0 24 24" fill="#fafafa"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
};

function CredentialsManager({ navigateTo }) {
  const [communities, setCommunities] = useState([]);
  const [testResults, setTestResults] = useState({});
  const [testingAll, setTestingAll] = useState(false);
  const [passphrase, setPassphraseState] = useState(getPassphrase());
  const [passphraseInput, setPassphraseInput] = useState('');
  const [encrypted, setEncrypted] = useState(false);

  useEffect(() => {
    setCommunities(getCommunities());
  }, []);

  const platforms = ['Discord', 'LinkedIn', 'Reddit', 'X'];
  const grouped = {};
  for (const p of platforms) {
    grouped[p] = communities.filter(c => c.platform === p);
  }

  const allStatuses = communities.map(c => ({ ...c, credStatus: getCredentialStatus(c) }));
  const connectedCount = allStatuses.filter(c => c.credStatus === 'connected').length;
  const totalCount = communities.length;
  const missingCommunities = allStatuses.filter(c => c.credStatus === 'missing' || c.credStatus === 'expired');
  const warningCommunities = allStatuses.filter(c => c.credStatus === 'expiring');

  const handleSetPassphrase = () => {
    if (!passphraseInput.trim()) return;
    setPassphrase(passphraseInput.trim());
    setPassphraseState(passphraseInput.trim());
    encryptCommunityCredentials(getCommunities(), passphraseInput.trim());
    setEncrypted(true);
    setPassphraseInput('');
    setTimeout(() => setEncrypted(false), 2000);
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    const results = {};
    const passph = getPassphrase();
    const val = (c, k) => {
      const v = c.credentials?.[k] || '';
      return passph && v.startsWith('ENC:') ? decrypt(v, passph) : v;
    };

    for (const c of communities) {
      const id = c.id;
      try {
        if (c.platform === 'Discord' && val(c, 'webhookUrl')) {
          await testDiscordWebhook(val(c, 'webhookUrl'));
          results[id] = { ok: true, msg: 'Connected' };
        } else if (c.platform === 'LinkedIn' && val(c, 'accessToken')) {
          const r = await testLinkedInToken(val(c, 'accessToken'));
          results[id] = { ok: true, msg: `Connected as ${r.name}` };
        } else if (c.platform === 'Reddit' && val(c, 'appId')) {
          const r = await testRedditConnection(val(c, 'appId'), val(c, 'appSecret'), val(c, 'username'), val(c, 'password'));
          results[id] = { ok: true, msg: `u/${r.username}` };
        } else if (c.platform === 'X' && val(c, 'apiKey')) {
          const r = await testTwitterConnection({ apiKey: val(c, 'apiKey'), apiSecret: val(c, 'apiSecret'), accessToken: val(c, 'accessToken'), accessTokenSecret: val(c, 'accessTokenSecret') });
          results[id] = { ok: true, msg: `@${r.username}` };
        } else {
          results[id] = { ok: false, msg: 'Not configured' };
        }
      } catch (err) {
        results[id] = { ok: false, msg: err.message };
      }
    }

    setTestResults(results);
    setTestingAll(false);
  };

  const handleGoToCommunity = (communityId) => {
    if (navigateTo) navigateTo('communities', { expandCommunityId: communityId });
  };

  return (
    <div>
      {/* Health score */}
      <div className="card">
        <div className="card-title">Connection Health</div>
        <div className="cred-health-score">
          <div className="cred-health-number">{connectedCount}</div>
          <div className="cred-health-label">of {totalCount} communit{totalCount !== 1 ? 'ies' : 'y'} fully connected and ready to post</div>
        </div>
        {totalCount > 0 && (
          <div className="cred-health-bar-wrap" style={{ marginTop: 12 }}>
            <div className="cred-health-bar" style={{ width: `${(connectedCount / totalCount) * 100}%` }} />
          </div>
        )}
        {missingCommunities.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {missingCommunities.map(c => (
              <div key={c.id} className="cred-issue-row">
                <AlertTriangle size={13} />
                <span><strong>{c.name}</strong> ({c.platform}) — {c.credStatus === 'expired' ? 'token expired' : 'credentials missing'}</span>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto', padding: '3px 10px' }} onClick={() => handleGoToCommunity(c.id)}>Fix</button>
              </div>
            ))}
          </div>
        )}
        {warningCommunities.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {warningCommunities.map(c => (
              <div key={c.id} className="cred-issue-row cred-issue-warn">
                <AlertTriangle size={13} />
                <span><strong>{c.name}</strong> ({c.platform}) — {c.platform === 'X' ? 'approaching tweet limit' : 'token expiring soon'}</span>
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', padding: '3px 10px' }} onClick={() => handleGoToCommunity(c.id)}>Review</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test All */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Test All Connections</div>
          <button className="btn btn-primary btn-sm" onClick={handleTestAll} disabled={testingAll || totalCount === 0}>
            {testingAll ? <span className="spinner" /> : <Zap size={14} />}
            {testingAll ? 'Testing...' : 'Test All'}
          </button>
        </div>
        {Object.keys(testResults).length > 0 && (
          <div className="cred-test-results">
            {communities.map(c => {
              const r = testResults[c.id];
              if (!r) return null;
              return (
                <div key={c.id} className="cred-test-row">
                  {PLATFORM_ICONS[c.platform]}
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                  <span className={`cred-test-badge ${r.ok ? 'cred-test-ok' : 'cred-test-fail'}`}>
                    {r.ok ? <Check size={11} /> : <X size={11} />}
                    {r.msg}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Per-platform breakdown */}
      {platforms.map(p => {
        const comms = grouped[p];
        if (comms.length === 0) return null;
        return (
          <div key={p} className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {PLATFORM_ICONS[p]}
              {p === 'X' ? 'Twitter/X' : p}
              <span className="tab-count">{comms.length}</span>
            </div>
            <div className="cred-platform-list">
              {comms.map(c => {
                const status = getCredentialStatus(c);
                const { text, cls } = getStatusLabel(status);
                return (
                  <div key={c.id} className="cred-platform-row">
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                    <span className={`cred-status-badge ${cls}`}>{text}</span>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '3px 10px' }} onClick={() => handleGoToCommunity(c.id)}>Setup</button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Encryption */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={16} />
          Credential Encryption
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Encrypt stored credentials with a passphrase. The passphrase is only kept in your browser session and cleared when you close the tab.
        </p>
        {passphrase ? (
          <p style={{ fontSize: 13, color: 'var(--success)' }}>Passphrase set for this session. Credentials are encrypted.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, maxWidth: 300 }}>
              <label className="form-label">Passphrase</label>
              <input className="form-input" type="password" placeholder="Enter a passphrase..." value={passphraseInput} onChange={e => setPassphraseInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSetPassphrase()} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleSetPassphrase}>
              <Lock size={14} /> Encrypt
            </button>
          </div>
        )}
        {encrypted && <span className="status-msg" style={{ marginLeft: 0, marginTop: 8, display: 'block' }}>Credentials encrypted!</span>}
      </div>
    </div>
  );
}

export default function Settings({ navigateTo }) {
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const update = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleClearAll = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    const keys = Object.keys(localStorage).filter(k => k.startsWith('postforge_'));
    keys.forEach(k => localStorage.removeItem(k));
    setConfirmClear(false);
    setCleared(true);
    setSettings(DEFAULT_SETTINGS);
    setTimeout(() => setCleared(false), 3000);
  };

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Configure PostForge preferences, credentials, and defaults.</p>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'general' ? 'tab-active' : ''}`} onClick={() => setTab('general')}>General</button>
        <button className={`tab-btn ${tab === 'credentials' ? 'tab-active' : ''}`} onClick={() => setTab('credentials')}>
          <Key size={14} /> Credentials
        </button>
      </div>

      {tab === 'general' && (
        <>
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={16} />Burnout Protection</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Get reminded when you haven't posted in a while.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div className="toggle-wrapper" onClick={() => update('burnoutEnabled', !settings.burnoutEnabled)} style={{ marginLeft: 0 }}>
                <div className={`toggle ${settings.burnoutEnabled ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
                <span className="toggle-label">{settings.burnoutEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
            {settings.burnoutEnabled && (
              <div className="form-group" style={{ maxWidth: 300 }}>
                <label className="form-label">Alert after days of inactivity</label>
                <input className="form-input" type="number" min="1" max="90" value={settings.burnoutDays} onChange={e => update('burnoutDays', Math.max(1, parseInt(e.target.value) || 7))} />
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Key size={16} />Default API Key</div>
            <div className="form-group" style={{ maxWidth: 500 }}>
              <label className="form-label">API Key</label>
              <input className="form-input" type="password" placeholder="sk-ant-..." value={settings.apiKey} onChange={e => update('apiKey', e.target.value)} />
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={16} />Default Post Time</div>
            <div className="form-group" style={{ maxWidth: 200 }}>
              <label className="form-label">Default Time</label>
              <input className="form-input" type="time" value={settings.defaultPostTime} onChange={e => update('defaultPostTime', e.target.value)} />
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}><Trash2 size={16} />Clear All Data</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Permanently delete all PostForge data.</p>
            {!cleared ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-danger" onClick={handleClearAll}>
                  <Trash2 size={14} />{confirmClear ? 'Yes, delete everything' : 'Clear All Data'}
                </button>
                {confirmClear && (<>
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(false)}>Cancel</button>
                  <span style={{ fontSize: 13, color: 'var(--danger)' }}><AlertTriangle size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />This cannot be undone!</span>
                </>)}
              </div>
            ) : <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>All data cleared.</p>}
          </div>
        </>
      )}

      {tab === 'credentials' && <CredentialsManager navigateTo={navigateTo} />}

      {saved && <div style={{ position: 'fixed', bottom: 20, right: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>Settings saved</div>}
    </div>
  );
}

export { getSettings };
