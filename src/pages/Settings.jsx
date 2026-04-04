import { useState, useEffect } from 'react';
import { Shield, Key, Clock, Trash2, AlertTriangle, Zap, Check, X, Lock, ShieldCheck, Globe, BarChart2, Download, Upload, Database, HeartPulse, Sparkles, Bell, Settings as SettingsIcon, Sliders } from 'lucide-react';
import { getSafetySettings, saveSafetySettings } from '../lib/safety';
import { runHealthCheck, resetKey } from '../lib/safeStorage';
import { showTypeConfirm } from '../components/UndoManager';
import { testDiscordWebhook, testLinkedInToken, testRedditConnection, testTwitterConnection, getTwitterUsage } from '../lib/posting';
import { getCredentialHealth, getLastTestResult, recordSuccess, recordTestFailure, needsTest } from '../lib/credentialExpiry';

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
  const health = getCredentialHealth(community);
  if (health.status === 'unknown') return 'missing';
  if (health.status === 'expired') return 'expired';
  if (health.status === 'expiring') return 'expiring';
  if (health.status === 'warning') return 'expiring';
  // Check last test result
  const lastTest = getLastTestResult(community.platform, community.id);
  if (lastTest.ok === false) return 'expiring';
  return 'connected';
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
                const health = getCredentialHealth(c);
                return (
                  <div key={c.id} className={`cred-platform-row ${status === 'expired' || status === 'expiring' ? 'cred-row-warn' : ''}`}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>{health.message}</span>
                    {health.usageInfo && (
                      <div className="ce-usage-mini">
                        <div className="ce-usage-mini-bar" style={{ width: `${health.usageInfo.pct}%`, background: health.usageInfo.pct >= 80 ? '#eab308' : 'var(--accent)' }} />
                      </div>
                    )}
                    <span className={`cred-status-badge ${cls}`}>{text}</span>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '3px 10px' }} onClick={() => handleGoToCommunity(c.id)}>
                      {status === 'expiring' || status === 'expired' ? 'Renew' : 'Setup'}
                    </button>
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

const BACKUP_KEYS = [
  'postforge_communities', 'postforge_products', 'postforge_product', 'postforge_blocks',
  'postforge_history', 'postforge_post_log', 'postforge_top_posts', 'postforge_engagement',
  'postforge_voice', 'postforge_style_dna', 'postforge_settings', 'postforge_safety',
  'postforge_rules', 'postforge_rules_log', 'postforge_templates', 'postforge_campaigns',
  'postforge_approval_queue', 'postforge_launch_schedule', 'postforge_launch_history',
  'postforge_manual_schedule', 'postforge_ab_results', 'postforge_custom_prompts',
  'postforge_prompt_config', 'postforge_goals', 'postforge_recycler', 'postforge_schedule',
  'postforge_smart', 'postforge_twitter_usage', 'postforge_last_post_dates',
  'postforge_active_product_id', 'postforge_freshness_log', 'postforge_safety_log',
];

function DataManagement() {
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);
  const [importing, setImporting] = useState(false);

  const lastBackup = localStorage.getItem('postforge_last_backup');
  const daysSinceBackup = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000) : null;

  const handleExport = () => {
    const data = { _postforge_backup: true, version: 1, exportedAt: new Date().toISOString(), data: {} };
    for (const key of BACKUP_KEYS) {
      const val = localStorage.getItem(key);
      if (val !== null) data.data[key] = val;
    }
    // Also grab any other postforge_ keys we might have missed
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('postforge_') && !data.data[key]) {
        data.data[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `postforge-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem('postforge_last_backup', new Date().toISOString());
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportPreview(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed._postforge_backup || !parsed.data) {
          setImportError('Invalid backup file — please use a PostForge backup.');
          return;
        }
        // Count items
        const communities = parsed.data.postforge_communities ? JSON.parse(parsed.data.postforge_communities).length : 0;
        const products = parsed.data.postforge_products ? JSON.parse(parsed.data.postforge_products).length : 0;
        const posts = parsed.data.postforge_history ? JSON.parse(parsed.data.postforge_history).length : 0;
        const keys = Object.keys(parsed.data).length;
        setImportPreview({ parsed, communities, products, posts, keys, date: parsed.exportedAt });
      } catch {
        setImportError('Invalid backup file — could not parse JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = () => {
    if (!importPreview) return;
    setImporting(true);
    // Clear existing postforge data
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('postforge_')) localStorage.removeItem(key);
    }
    // Write backup data
    for (const [key, value] of Object.entries(importPreview.parsed.data)) {
      localStorage.setItem(key, value);
    }
    localStorage.setItem('postforge_last_backup', new Date().toISOString());
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <div>
      {/* Backup reminder */}
      {(daysSinceBackup === null || daysSinceBackup >= 30) && (
        <div className="dm-reminder">
          <AlertTriangle size={14} />
          {daysSinceBackup === null
            ? "You've never backed up your data — export a backup to protect your work."
            : `Your last backup was ${daysSinceBackup} days ago — export a fresh backup to protect your data.`
          }
        </div>
      )}

      {/* Export */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Download size={16} /> Export All Data
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Download a complete backup of all your PostForge data — communities, products, history, engagement, settings, and more.
        </p>
        <button className="btn btn-primary" onClick={handleExport}>
          <Download size={14} /> Export Backup
        </button>
        {exportSuccess && <span className="status-msg" style={{ marginLeft: 12 }}>Backup downloaded successfully!</span>}
        {lastBackup && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            Last backed up: {new Date(lastBackup).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* Import */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={16} /> Import Data
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Restore from a PostForge backup file. This will replace all current data.
        </p>
        <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
          <Upload size={14} /> Select Backup File
          <input type="file" accept=".json" onChange={handleFileSelect} style={{ display: 'none' }} />
        </label>

        {importError && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <X size={14} /> {importError}
          </div>
        )}

        {importPreview && (
          <div className="dm-import-preview">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Backup Preview</div>
            <div className="dm-preview-stats">
              <span>{importPreview.products} products</span>
              <span>{importPreview.communities} communities</span>
              <span>{importPreview.posts} posts</span>
              <span>{importPreview.keys} data keys</span>
            </div>
            {importPreview.date && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                Exported on {new Date(importPreview.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
            <div style={{ padding: 8, background: 'rgba(239, 68, 68, 0.06)', borderRadius: 6, fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>
              <AlertTriangle size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Import will replace your current data. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" onClick={handleImport} disabled={importing}>
                {importing ? <span className="spinner" /> : <Upload size={14} />}
                {importing ? 'Importing...' : 'Import and replace all data'}
              </button>
              <button className="btn btn-secondary" onClick={() => setImportPreview(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Storage info */}
      <div className="card">
        <div className="card-title">Storage Usage</div>
        <div className="dm-storage-list">
          {(() => {
            const items = [];
            for (const key of Object.keys(localStorage).filter(k => k.startsWith('postforge_')).sort()) {
              const val = localStorage.getItem(key) || '';
              const kb = (val.length / 1024).toFixed(1);
              items.push({ key: key.replace('postforge_', ''), size: kb });
            }
            return items.map(i => (
              <div key={i.key} className="dm-storage-row">
                <span className="dm-storage-key">{i.key}</span>
                <span className="dm-storage-size">{i.size} KB</span>
              </div>
            ));
          })()}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
          Total: {(Object.keys(localStorage).filter(k => k.startsWith('postforge_')).reduce((s, k) => s + (localStorage.getItem(k) || '').length, 0) / 1024).toFixed(1)} KB
        </div>
      </div>

      {/* Health Check */}
      <HealthCheck />
    </div>
  );
}

function HealthCheck() {
  const [report, setReport] = useState(null);
  const [repairing, setRepairing] = useState(false);

  const handleRun = () => { setReport(runHealthCheck()); };

  const handleResetKey = (key) => {
    resetKey(key);
    setReport(runHealthCheck());
  };

  const handleRepairAll = () => {
    if (!report) return;
    setRepairing(true);
    for (const c of report.corrupted) resetKey(c.key);
    setTimeout(() => { setReport(runHealthCheck()); setRepairing(false); }, 300);
  };

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <HeartPulse size={16} /> Data Health Check
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Validate all PostForge data for corruption. Corrupted keys can be reset individually without affecting healthy data.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn btn-primary btn-sm" onClick={handleRun}>
          <HeartPulse size={13} /> Run Health Check
        </button>
        {report && report.corrupted.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={handleRepairAll} disabled={repairing}>
            {repairing ? <span className="spinner" /> : <Zap size={13} />}
            Repair All ({report.corrupted.length})
          </button>
        )}
      </div>

      {report && (
        <div style={{ marginTop: 12 }}>
          <div className="hc-summary">
            <span className="hc-healthy"><Check size={12} /> {report.healthy.length} healthy</span>
            {report.corrupted.length > 0 ? (
              <span className="hc-corrupted"><X size={12} /> {report.corrupted.length} corrupted</span>
            ) : (
              <span className="hc-healthy"><Check size={12} /> No corruption found</span>
            )}
          </div>

          {report.corrupted.length > 0 && (
            <div className="hc-corrupted-list">
              {report.corrupted.map(c => (
                <div key={c.key} className="hc-corrupted-row">
                  <div>
                    <div className="dm-storage-key">{c.key.replace('postforge_', '')}</div>
                    <div style={{ fontSize: 10, color: 'var(--danger)' }}>{c.error}</div>
                  </div>
                  <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => handleResetKey(c.key)}>
                    Reset
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SafetyConfig() {
  const [safety, setSafety] = useState(getSafetySettings());

  const toggle = (key) => {
    const updated = { ...safety, [key]: !safety[key] };
    setSafety(updated);
    saveSafetySettings(updated);
  };

  const rules = [
    {
      key: 'redditSafeMode',
      title: 'Reddit Safe Mode',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff4500"><path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0z"/></svg>,
      items: [
        'Never post the exact same content twice to the same subreddit',
        'Add slight variations to post timing (±15 minutes randomness)',
        'Minimum 4 hour gap between posts to same subreddit',
        'Warn if posting frequency exceeds 3 posts per day per subreddit',
      ],
    },
    {
      key: 'spamPrevention',
      title: 'Spam Prevention',
      icon: <Shield size={14} />,
      items: [
        'AI automatically varies opening sentences across communities',
        'Never use the exact same first line twice in 30 days',
        'Flag posts that look too promotional (exclamation marks, caps, multiple links)',
      ],
    },
    {
      key: 'rateLimiting',
      title: 'Rate Limiting',
      icon: <Clock size={14} />,
      items: [
        'Discord: max 5 posts per hour per webhook',
        'LinkedIn: max 3 posts per day per account',
        'Twitter: track monthly limit and pace posts',
        'Reddit: max 2 posts per day per subreddit',
      ],
    },
    {
      key: 'contentSafetyCheck',
      title: 'Content Safety Check',
      icon: <ShieldCheck size={14} />,
      items: [
        'Check if the post sounds authentic or too spammy before sending',
        'Score from 1-10 — warn if authenticity score is below 6',
        'Show the score and reason before the post goes out',
      ],
    },
  ];

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
        Safety features prevent bans and spam flags by enforcing rate limits, detecting duplicates, and scoring content authenticity.
      </p>
      {rules.map(rule => (
        <div key={rule.key} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {rule.icon}
              {rule.title}
            </div>
            <div className="toggle-wrapper" onClick={() => toggle(rule.key)} style={{ marginLeft: 0 }}>
              <div className={`toggle ${safety[rule.key] ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
              <span className="toggle-label">{safety[rule.key] ? 'On' : 'Off'}</span>
            </div>
          </div>
          <ul className="safety-rule-list">
            {rule.items.map((item, i) => (
              <li key={i} className={safety[rule.key] ? '' : 'safety-rule-off'}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function generateCodebaseSummary() {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const PAGES_INFO = [
    'Dashboard — Momentum stats, weekly performance chart, platform breakdown, product leaderboard, activity feed, upcoming posts, goal tracker, Performance tab (Hall of Fame, matrix, trends, fatigue, win rates)',
    'Generator — Post generation with tone/type/community selectors, A/B testing, custom prompt builder, platform preview, character counter, quality scorer, rewrite assistant, voice profile integration, Style DNA context',
    'Communities — Community CRUD with platform-specific setup (Discord webhook, LinkedIn OAuth, Reddit API, Twitter/X API), health badges, credential expiry, block overrides, advanced posting settings, rankings tab with Style DNA',
    'Product Hub — Product CRUD with tags/categories/status, My Products library with search/filter/sort, product activation with scheduled posting, per-product analytics, My Voice tab with writing samples and voice analysis',
    'Automation — 7 sub-tabs: Modes (Instant/Scheduled/Approval/Smart/Launch), Templates (recurring), Campaigns (multi-product with phases + optimizer), Rules (if/then engine), Failed Posts, Post Queue (unified), plus Optimal Timing, Posting Log, Post Recycler, Safety Log, Freshness Report',
    'Content Calendar — Monthly grid view with platform-colored dots, day detail panel, drag-to-reschedule, Fill Gaps auto-generation, monthly summary',
    'History — Paginated/infinite scroll post list with search, engagement tracking (platform metrics + scoring gauge), top posts, repurpose engine, stats bar with export, undo delete',
    'Settings — 6 tabs: General (simple mode, API key, timezone, goals), Posting Safety (4 rule sets), Notifications (6 toggles), Credentials (health dashboard + encryption), Data (export/import/health check), Advanced (prompt/optimizer/freshness/queue/debug/dev tools)',
  ];

  const FEATURES = [
    'Post Generation — 6 tones × 6 post types with template engine',
    'A/B Community Testing — side-by-side comparison with voting and insights',
    'A/B Prompt Testing — default vs custom prompt comparison',
    'Custom Prompt Builder — system prompt override, 12 variables, 5 presets, saved templates',
    'Post Quality Scorer — 5-dimension scoring via Claude API or heuristic (hook/clarity/authenticity/fit/CTA)',
    'Rewrite Assistant — 8 quick rewrites + custom input, version history with restore',
    'Platform Preview — Discord/LinkedIn/Reddit/X styled post previews',
    'Character Counter — color-coded bar (Twitter/Reddit/long-form thresholds)',
    'Voice/Tone Calibrator — 5 writing samples → Claude API voice analysis → profile card',
    'Style DNA System — auto-extraction from high performers, community style profiles, generation context',
    'Community Health — Active/Fading/Silent badges based on last post date',
    'Credential Expiry Tracking — LinkedIn 60-day token, Reddit success tracking, Twitter usage counter',
    'Platform API Integration — Discord webhook, LinkedIn UGC, Reddit OAuth, Twitter OAuth 1.0a with test connections',
    'Posting Safety — Reddit safe mode, spam prevention, rate limiting, content authenticity scoring',
    'Freshness Guard — duplicate detection, opening line freshness, phrase fatigue, topic rotation',
    'Engagement Tracking — platform-specific metrics, sentiment, unified 0-100 normalized scoring',
    'Post Type Rankings — per-community leaderboard with trends, medals, best examples',
    'Performance Analytics — Hall of Fame, performance matrix, trend lines, fatigue detector, win rates',
    'Community Rankings — topic distribution chart, fatigued phrases list, "What Works Here" card',
    'Automation Modes — Instant, Scheduled, Approval Queue, Smart Mode, Launch Mode (staggered)',
    'Recurring Templates — Daily/Weekly/Monthly/Custom schedules with auto-run and history',
    'Campaign Manager — multi-product/community campaigns with Smart Phases (Discovery→Optimization→Amplification)',
    'Campaign Optimizer — AI style extraction, underperformer substitution, side-by-side comparison',
    'Rules Engine — 6 triggers, 5 actions, 4 preset templates, auto-evaluation timer',
    'Post Queue — unified queue from all sources, pause/resume, edit/reschedule modals, filters',
    'Content Calendar — monthly grid, peak engagement windows, conflict detection, click-to-schedule',
    'Optimal Timing — per-platform peak windows, 7-day calendar, schedule conflict warnings',
    'Post Recycler — rewrites old posts for freshness, sends to approval queue',
    'Auto-Repurpose Engine — cross-platform content adaptation via Claude API',
    'Goal Tracker — 5 goal types with progress rings, heatmap, launch countdown',
    'Product Analytics — per-product stats, performance timeline, community reach, changelog, export',
    'Product Library — tags, categories, status, search/filter/sort, archive with deactivation',
    'Failure Detection — 5 failure categories with fix instructions, retry queue, global banner',
    'API Queue — Claude API rate limiting with priority, platform rate limiters, retry queue',
    'Safe Storage — try/catch localStorage wrapper, corruption recovery, storage-full alerts',
    'Data Backup — full JSON export/import, auto-backup reminders, health check with repair',
    'Credential Encryption — XOR+base64 with session passphrase',
    'Simple Mode — hides advanced features for new users, floating hint after 3 days',
    'Undo System — 5-second undo toasts (max 3 stacked), type-to-confirm for destructive actions',
    'Burnout Protection — inactivity banner with Generate Check-in shortcut',
    'Pagination — 20 per page with search, infinite scroll option, debounced filtering',
  ];

  const keys = Object.keys(localStorage).filter(k => k.startsWith('postforge_')).sort();
  const KEY_DESCRIPTIONS = {
    postforge_communities: 'Array of community objects (credentials, block settings, posting settings, platform config)',
    postforge_products: 'Array of product objects (tags, category, status, schedule, activation state)',
    postforge_product: 'Currently loaded product in the editor',
    postforge_blocks: 'Content blocks data (voice samples, update log, roadmap, CTA, story, social proof)',
    postforge_active_product_id: 'ID of the currently loaded product',
    postforge_history: 'Array of generated/saved posts with content, community, tone, date',
    postforge_post_log: 'Array of sent post log entries with status, error, platform',
    postforge_top_posts: 'Array of user-starred high-performing posts',
    postforge_engagement: 'Object keyed by post ID with platform metrics and sentiment',
    postforge_voice: 'Writing samples array + analyzed voice profile object',
    postforge_style_dna: 'Extracted Style DNA objects keyed by post ID',
    postforge_settings: 'Global settings (API key, timezone, goals, mode preferences, thresholds)',
    postforge_safety: 'Safety toggle states (Reddit safe mode, spam, rate limiting, content check)',
    postforge_safety_log: 'Safety rule trigger log entries',
    postforge_freshness_log: 'Freshness Guard action log entries',
    postforge_failures: 'Failed post entries with error details and retry counts',
    postforge_rules: 'Automation if/then rules with triggers and actions',
    postforge_rules_log: 'Rule execution log entries',
    postforge_templates: 'Recurring post templates with schedules and run history',
    postforge_campaigns: 'Campaign objects with posts, phases, status, settings',
    postforge_approval_queue: 'Posts pending approval before sending',
    postforge_launch_schedule: 'Launch Mode scheduled posts with stagger timing',
    postforge_launch_history: 'Completed launch records with sent/failed counts',
    postforge_manual_schedule: 'Manually scheduled posts from calendar clicks',
    postforge_schedule: 'Scheduled Mode time and active state',
    postforge_smart: 'Smart Mode time and active state',
    postforge_recycler: 'Recycler enabled/interval settings',
    postforge_ab_results: 'A/B test voting results history',
    postforge_custom_prompts: 'User-saved prompt templates',
    postforge_prompt_config: 'Custom prompt enabled/text/A/B toggle state',
    postforge_goals: 'Goal tracking data (weekly, coverage, streak, reach, launch tasks)',
    postforge_twitter_usage: 'Monthly tweet count tracking { month, count }',
    postforge_last_post_dates: 'Last post date per community name (ISO string)',
    postforge_cred_tracker: 'Credential test results and Reddit success dates per community',
    postforge_last_backup: 'Last data export timestamp (ISO string)',
    postforge_simple_mode: 'Simple/Advanced mode toggle ("true"/"false")',
    postforge_first_use: 'First app use date for hint timing (ISO string)',
    postforge_advanced_hint_dismissed: 'Whether "Ready for more?" hint was dismissed',
    postforge_burnout_dismissed: 'Today\'s date if burnout banner was dismissed',
    postforge_queue_paused: 'Whether the post queue is paused ("true"/"false")',
    postforge_settings_tab: 'Last active Settings tab name',
    postforge_eng_reminder_dismissed: 'Today\'s date if engagement reminder was dismissed',
  };

  let text = `PostForge Codebase Summary — ${date}\n\n`;
  text += `Tech: React + Vite, plain CSS, localStorage, lucide-react icons. No external UI libs.\n`;
  text += `Files: 43 source files (8 pages, 21 components, 14 lib modules)\n\n`;

  text += `PAGES:\n`;
  PAGES_INFO.forEach(p => { text += `- ${p}\n`; });

  text += `\nFEATURES BUILT:\n`;
  FEATURES.forEach(f => { text += `- ${f}\n`; });

  text += `\nLOCALSTORAGE KEYS (${keys.length} active):\n`;
  keys.forEach(k => {
    const desc = KEY_DESCRIPTIONS[k] || 'Unknown';
    const size = ((localStorage.getItem(k) || '').length / 1024).toFixed(1);
    text += `- ${k}: ${desc} [${size} KB]\n`;
  });

  text += `\nCURRENT KNOWN ISSUES:\n[Add any known bugs or issues here]\n`;
  text += `\nNEXT PLANNED FEATURES:\n[Add planned features here]\n`;

  return text;
}

const FEATURE_CHECKLIST = [
  { category: 'Core Generation', items: [
    'Template-based post generation (6 tones × 6 types)', 'Community-specific generation', 'Voice profile integration',
    'Style DNA context injection', 'Top posts as inspiration', 'Content blocks system',
  ]},
  { category: 'Post Enhancement', items: [
    'Post quality scorer (5 dimensions)', 'Rewrite assistant (8 presets + custom)', 'Platform preview (Discord/LinkedIn/Reddit/X)',
    'Character counter with thresholds', 'A/B community testing', 'A/B prompt testing', 'Custom prompt builder',
  ]},
  { category: 'Community Management', items: [
    'Discord webhook setup + test', 'LinkedIn OAuth setup + test', 'Reddit API setup + test', 'Twitter/X API setup + test',
    'Community health indicators', 'Credential expiry tracking', 'Block overrides per community',
    'Advanced posting settings (forbidden words, length, emoji)', 'Post type rankings with trends',
  ]},
  { category: 'Automation', items: [
    'Instant Mode', 'Scheduled Mode', 'Approval Queue', 'Smart Mode', 'Launch Mode (staggered)',
    'Recurring templates', 'Campaign manager with Smart Phases', 'Campaign optimizer (AI style extraction)',
    'Rules engine (if/then triggers)', 'Post queue (unified)', 'Post recycler',
  ]},
  { category: 'Analytics & Tracking', items: [
    'Dashboard with 6 stat sections', 'Performance tab (Hall of Fame, matrix, trends, fatigue, win rates)',
    'Goal tracker (5 goal types)', 'Engagement tracking (platform metrics)', 'Unified scoring engine (0-100)',
    'Product analytics with export', 'Community rankings', 'Style DNA system',
  ]},
  { category: 'Safety & Reliability', items: [
    'Posting safety engine (4 rule sets)', 'Freshness Guard (duplicate/opening/phrase/topic)',
    'API queue with rate limiting', 'Platform rate limiters', 'Failure detection (5 categories)',
    'Safe storage wrapper', 'Data health check', 'Credential encryption',
  ]},
  { category: 'UX & Polish', items: [
    'Simple Mode for new users', 'Undo toast system (5s, max 3)', 'Type-to-confirm for destructive actions',
    'Burnout protection banner', 'Content calendar (monthly grid)', 'Paginated history with search',
    'Data backup/restore', 'Dark theme throughout', 'Platform-colored badges',
  ]},
];

function DevTools() {
  const [open, setOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateSummary = () => {
    setSummaryText(generateCodebaseSummary());
    setShowSummary(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <button className="aps-toggle" onClick={() => setOpen(!open)} style={{ fontSize: 13 }}>
        {open ? '▾' : '▸'} Developer Tools
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            Generate summaries for Claude Code sessions or track what's been built.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={handleGenerateSummary}>Generate Codebase Summary</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowChecklist(!showChecklist)}>
              {showChecklist ? 'Hide' : "What's Built"}
            </button>
          </div>

          {/* What's Built checklist */}
          {showChecklist && (
            <div className="dt-checklist">
              {FEATURE_CHECKLIST.map(cat => (
                <div key={cat.category} className="dt-cat">
                  <div className="dt-cat-title">{cat.category}</div>
                  {cat.items.map(item => (
                    <div key={item} className="dt-check-row">
                      <Check size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                {FEATURE_CHECKLIST.reduce((s, c) => s + c.items.length, 0)} features built across {FEATURE_CHECKLIST.length} categories
              </div>
            </div>
          )}

          {/* Summary modal */}
          {showSummary && (
            <div className="pq-modal-overlay" onClick={() => setShowSummary(false)}>
              <div className="pq-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '85vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Codebase Summary</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary btn-sm" onClick={handleCopy}>
                      {copied ? <><Check size={12} /> Copied!</> : 'Copy to Clipboard'}
                    </button>
                    <button className="pa-close" onClick={() => setShowSummary(false)}><X size={16} /></button>
                  </div>
                </div>
                <pre className="dt-summary-pre">{summaryText}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Settings({ navigateTo }) {
  const savedTab = localStorage.getItem('postforge_settings_tab') || 'general';
  const [tab, setTab] = useState(savedTab);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => { setSettings(getSettings()); }, []);

  const changeTab = (t) => { setTab(t); localStorage.setItem('postforge_settings_tab', t); };

  const update = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleClearAll = async () => {
    const confirmed = await showTypeConfirm('This will permanently delete ALL PostForge data including products, communities, history, and settings. This cannot be undone.');
    if (!confirmed) return;
    Object.keys(localStorage).filter(k => k.startsWith('postforge_')).forEach(k => localStorage.removeItem(k));
    setCleared(true); setSettings(DEFAULT_SETTINGS);
    setTimeout(() => setCleared(false), 3000);
  };

  const TABS = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'safety', label: 'Posting Safety', icon: ShieldCheck },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'credentials', label: 'Credentials', icon: Key },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'advanced', label: 'Advanced', icon: Sliders },
  ];

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Configure PostForge preferences, credentials, and defaults.</p>

      <div className="tab-bar" style={{ flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'tab-active' : ''}`} onClick={() => changeTab(t.id)}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* ===== Tab 1: General ===== */}
      {tab === 'general' && (
        <>
          <div className={`sm-banner ${localStorage.getItem('postforge_simple_mode') === 'false' ? 'sm-banner-advanced' : 'sm-banner-simple'}`}>
            {localStorage.getItem('postforge_simple_mode') === 'false' ? 'Advanced Mode — all features enabled' : 'Simple Mode is on — showing essential features only'}
          </div>

          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={16} />Interface Mode</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Simple Mode hides advanced features. Turn it off to unlock everything.</p>
            <div className="toggle-wrapper" onClick={() => { const next = localStorage.getItem('postforge_simple_mode') === 'false' ? 'true' : 'false'; localStorage.setItem('postforge_simple_mode', next); window.dispatchEvent(new Event('storage')); }} style={{ marginLeft: 0 }}>
              <div className={`toggle ${localStorage.getItem('postforge_simple_mode') !== 'false' ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
              <span className="toggle-label">{localStorage.getItem('postforge_simple_mode') !== 'false' ? 'Simple Mode' : 'Advanced Mode'}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Key size={16} />Default API Key</div>
            <div className="form-group" style={{ maxWidth: 500 }}>
              <label className="form-label">API Key</label>
              <input className="form-input" type="password" placeholder="sk-ant-..." value={settings.apiKey} onChange={e => update('apiKey', e.target.value)} />
            </div>
          </div>

          <div className="form-grid" style={{ gap: 16, marginBottom: 20 }}>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={16} />Default Post Time</div>
              <input className="form-input" type="time" value={settings.defaultPostTime} onChange={e => update('defaultPostTime', e.target.value)} style={{ maxWidth: 150 }} />
            </div>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart2 size={16} />Daily Post Goal</div>
              <select className="form-select" value={settings.dailyGoal || 1} onChange={e => update('dailyGoal', Number(e.target.value))} style={{ maxWidth: 100 }}>
                {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n} post{n > 1 ? 's' : ''}/day</option>)}
              </select>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Globe size={16} />Timezone</div>
            <div className="form-group" style={{ maxWidth: 300 }}>
              <select className="form-select" value={settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} onChange={e => update('timezone', e.target.value)}>
                {Intl.supportedValuesOf('timeZone').map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={16} />History Display</div>
            <select className="form-select" value={settings.historyMode || 'pagination'} onChange={e => update('historyMode', e.target.value)} style={{ maxWidth: 250 }}>
              <option value="pagination">Pagination (20 per page)</option>
              <option value="infinite">Infinite Scroll</option>
            </select>
          </div>

          <div className="card" style={{ opacity: 0.5 }}>
            <div className="card-title">Theme</div>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Dark theme active. Light theme coming soon.</p>
          </div>
        </>
      )}

      {/* ===== Tab 2: Posting Safety ===== */}
      {tab === 'safety' && <SafetyConfig />}

      {/* ===== Tab 3: Notifications ===== */}
      {tab === 'notifications' && (
        <>
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={16} />Burnout Protection</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Get reminded when you haven't posted in a while.</p>
            <div className="toggle-wrapper" onClick={() => update('burnoutEnabled', !settings.burnoutEnabled)} style={{ marginLeft: 0, marginBottom: 12 }}>
              <div className={`toggle ${settings.burnoutEnabled ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
              <span className="toggle-label">{settings.burnoutEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            {settings.burnoutEnabled && (
              <div className="form-group" style={{ maxWidth: 200 }}>
                <label className="form-label">Alert after days of inactivity</label>
                <input className="form-input" type="number" min="1" max="90" value={settings.burnoutDays} onChange={e => update('burnoutDays', Math.max(1, parseInt(e.target.value) || 7))} />
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart2 size={16} />Engagement Reminders</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Get reminded to log engagement on recent posts.</p>
            <div className="toggle-wrapper" onClick={() => update('engagementReminder', !settings.engagementReminder)} style={{ marginLeft: 0, marginBottom: 12 }}>
              <div className={`toggle ${settings.engagementReminder ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
              <span className="toggle-label">{settings.engagementReminder ? 'Enabled' : 'Disabled'}</span>
            </div>
            {settings.engagementReminder && (
              <div className="form-group" style={{ maxWidth: 200 }}>
                <label className="form-label">Remind after hours</label>
                <input className="form-input" type="number" min="1" max="72" value={settings.engagementReminderHours || 24} onChange={e => update('engagementReminderHours', Number(e.target.value) || 24)} />
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Other Notifications</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'weeklyBanner', label: 'Weekly summary banner on Mondays' },
                { key: 'expiryWarnings', label: 'Credential expiry warnings' },
                { key: 'failedAlerts', label: 'Failed post alerts' },
                { key: 'streakReminders', label: 'Streak reminders when close to breaking' },
              ].map(n => (
                <div key={n.key} className="toggle-wrapper" onClick={() => update(n.key, settings[n.key] === false ? true : settings[n.key] === undefined ? false : !settings[n.key])} style={{ marginLeft: 0 }}>
                  <div className={`toggle ${settings[n.key] !== false ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
                  <span className="toggle-label">{n.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ===== Tab 4: Credentials ===== */}
      {tab === 'credentials' && <CredentialsManager navigateTo={navigateTo} />}

      {/* ===== Tab 5: Data Management ===== */}
      {tab === 'data' && (
        <>
          <DataManagement />

          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}><Trash2 size={16} />Clear All Data</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Permanently delete all PostForge data.</p>
            {!cleared ? (
              <button className="btn btn-danger" onClick={handleClearAll}><Trash2 size={14} /> Clear All Data</button>
            ) : <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>All data cleared.</p>}
          </div>
        </>
      )}

      {/* ===== Tab 6: Advanced ===== */}
      {tab === 'advanced' && (
        <>
          <div className="card">
            <div className="card-title">Default System Prompt</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Customize the default prompt used when generating posts. Override per-community in the Generator's Prompt Builder.</p>
            <textarea className="form-textarea" style={{ minHeight: 100, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12 }} value={settings.defaultSystemPrompt || ''} onChange={e => update('defaultSystemPrompt', e.target.value)} placeholder="Leave empty to use the built-in default..." />
          </div>

          <div className="card">
            <div className="card-title">Optimizer Sensitivity</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>How aggressively the campaign optimizer replaces underperforming posts. Lower = more conservative.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="range" min="30" max="90" value={settings.optimizerThreshold || 70} onChange={e => update('optimizerThreshold', Number(e.target.value))} className="goal-slider" style={{ flex: 1, maxWidth: 200 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{settings.optimizerThreshold || 70}%</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Posts below this % of community average get flagged</span>
          </div>

          <div className="card">
            <div className="card-title">Freshness Guard</div>
            <div className="form-grid" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Similarity threshold (%)</label>
                <input className="form-input" type="number" min="50" max="95" value={settings.freshnessThreshold || 70} onChange={e => update('freshnessThreshold', Number(e.target.value))} />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Block posts above this % similar</span>
              </div>
              <div className="form-group">
                <label className="form-label">Phrase fatigue count</label>
                <input className="form-input" type="number" min="2" max="10" value={settings.phraseFatigueThreshold || 3} onChange={e => update('phraseFatigueThreshold', Number(e.target.value))} />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Flag phrases used more than X times</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">API Queue Speed</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Gap between Claude API calls. Lower = faster but may hit rate limits.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="range" min="1" max="5" step="0.5" value={settings.apiQueueGap || 2} onChange={e => update('apiQueueGap', Number(e.target.value))} className="goal-slider" style={{ flex: 1, maxWidth: 200 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{settings.apiQueueGap || 2}s</span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Debug Mode</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Show raw API prompts and responses in a debug panel when generating posts.</p>
            <div className="toggle-wrapper" onClick={() => update('debugMode', !settings.debugMode)} style={{ marginLeft: 0 }}>
              <div className={`toggle ${settings.debugMode ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
              <span className="toggle-label">{settings.debugMode ? 'Debug On' : 'Debug Off'}</span>
            </div>
          </div>

          {/* Developer Tools */}
          <DevTools />
        </>
      )}

      {saved && <div style={{ position: 'fixed', bottom: 20, right: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--success)', fontWeight: 500, zIndex: 900 }}>Settings saved</div>}
    </div>
  );
}

export { getSettings };
