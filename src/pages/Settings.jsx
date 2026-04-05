import { useState, useRef } from 'react';
import { Key, Eye, EyeOff, Save, Download, Upload, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';

const POSTFORGE_KEYS = [
  'postforge_product',
  'postforge_communities',
  'postforge_history',
  'postforge_voice_samples',
  'postforge_api_key',
];

function exportData() {
  const data = {};
  for (const key of POSTFORGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) data[key] = raw;
    } catch {}
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'postforge-backup.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const { apiKey, setApiKey } = useApp();

  const [localKey, setLocalKey] = useState(apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [importError, setImportError] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const fileInputRef = useRef(null);

  const handleSaveKey = () => {
    setApiKey(localKey);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleImportClick = () => {
    setImportError('');
    fileInputRef.current?.click();
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object') throw new Error('Invalid file');
        for (const key of POSTFORGE_KEYS) {
          if (key in data) {
            localStorage.setItem(key, data[key]);
          }
        }
        window.location.reload();
      } catch (err) {
        setImportError('Failed to import: ' + (err.message || 'invalid file'));
      }
    };
    reader.onerror = () => setImportError('Failed to read file');
    reader.readAsText(file);
    e.target.value = '';
  };

  const canClear = confirmText === 'DELETE';

  const handleClearAll = () => {
    if (!canClear) return;
    for (const key of POSTFORGE_KEYS) {
      try { localStorage.removeItem(key); } catch {}
    }
    window.location.reload();
  };

  const savedStyle = { color: '#10b981', fontSize: 13, fontWeight: 600 };

  return (
    <div>
      <h1 className="page-title">Settings</h1>

      {/* API Key */}
      <div className="card">
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Key size={16} /> Anthropic API Key
        </h2>
        <div className="form-group">
          <label className="form-label">API Key</label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              type={showKey ? 'text' : 'password'}
              value={localKey}
              onChange={e => setLocalKey(e.target.value)}
              placeholder="sk-ant-..."
              style={{ paddingRight: 40, width: '100%' }}
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
              }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn btn-primary" onClick={handleSaveKey}>
            <Save size={16} /> Save
          </button>
          {savedMsg && <span style={savedStyle}>Saved!</span>}
        </div>
      </div>

      {/* Backup */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>Backup &amp; Restore</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
          Export all your PostForge data or restore from a previous backup.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={exportData}>
            <Download size={16} /> Export Data
          </button>
          <button className="btn btn-secondary" onClick={handleImportClick}>
            <Upload size={16} /> Import Data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
        </div>
        {importError && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#ef4444' }}>{importError}</div>
        )}
      </div>

      {/* Danger Zone */}
      <div
        className="card"
        style={{ borderColor: '#ef444455' }}
      >
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: 16,
            fontWeight: 600,
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertTriangle size={16} /> Clear All Data
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
          This will permanently delete your product, communities, voice samples, history, and API
          key. This cannot be undone. Type <strong style={{ color: 'var(--text)' }}>DELETE</strong> to confirm.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            style={{ maxWidth: 240 }}
          />
          <button
            className="btn btn-danger"
            onClick={handleClearAll}
            disabled={!canClear}
            style={
              canClear
                ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff' }
                : undefined
            }
          >
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
}
