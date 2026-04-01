import { useState, useEffect } from 'react';
import { Shield, Key, Clock, Trash2, AlertTriangle } from 'lucide-react';

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

export default function Settings() {
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
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    // Clear all postforge data
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
      <p className="page-subtitle">Configure PostForge preferences and defaults.</p>

      {/* Burnout Protection */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} />
          Burnout Protection
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Get reminded when you haven't posted in a while. PostForge will offer to generate a quick check-in post.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div className="toggle-wrapper" onClick={() => update('burnoutEnabled', !settings.burnoutEnabled)} style={{ marginLeft: 0 }}>
            <div className={`toggle ${settings.burnoutEnabled ? 'toggle-on' : ''}`}>
              <div className="toggle-knob" />
            </div>
            <span className="toggle-label">{settings.burnoutEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>

        {settings.burnoutEnabled && (
          <div className="form-group" style={{ maxWidth: 300 }}>
            <label className="form-label">Alert me after this many days of inactivity</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="90"
              value={settings.burnoutDays}
              onChange={e => update('burnoutDays', Math.max(1, parseInt(e.target.value) || 7))}
            />
          </div>
        )}
      </div>

      {/* API Key */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Key size={16} />
          Default API Key
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Set your API key once so you don't have to re-enter it in Generator.
        </p>
        <div className="form-group" style={{ maxWidth: 500 }}>
          <label className="form-label">API Key</label>
          <input
            className="form-input"
            type="password"
            placeholder="sk-ant-..."
            value={settings.apiKey}
            onChange={e => update('apiKey', e.target.value)}
          />
        </div>
      </div>

      {/* Default Post Time */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} />
          Default Post Time
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Global default time for scheduled posting, automation, and new product activations.
        </p>
        <div className="form-group" style={{ maxWidth: 200 }}>
          <label className="form-label">Default Time</label>
          <input
            className="form-input"
            type="time"
            value={settings.defaultPostTime}
            onChange={e => update('defaultPostTime', e.target.value)}
          />
        </div>
      </div>

      {/* Clear All Data */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
          <Trash2 size={16} />
          Clear All Data
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Permanently delete all PostForge data including products, communities, history, and settings.
        </p>
        {!cleared ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-danger" onClick={handleClearAll}>
              <Trash2 size={14} />
              {confirmClear ? 'Yes, delete everything' : 'Clear All Data'}
            </button>
            {confirmClear && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(false)}>Cancel</button>
                <span style={{ fontSize: 13, color: 'var(--danger)' }}>
                  <AlertTriangle size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  This cannot be undone!
                </span>
              </>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>All data cleared.</p>
        )}
      </div>

      {saved && <div style={{ position: 'fixed', bottom: 20, right: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>Settings saved</div>}
    </div>
  );
}

export { getSettings };
