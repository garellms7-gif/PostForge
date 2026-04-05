import { useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';

const PLATFORMS = ['Discord', 'Reddit', 'LinkedIn', 'Twitter/X', 'Facebook', 'Other'];
const TONES = ['Peer-to-peer', 'Professional', 'Casual', 'Hype', 'Vulnerable'];

const PLATFORM_COLORS = {
  Discord: '#5865f2',
  Reddit: '#ff4500',
  LinkedIn: '#0a66c2',
  'Twitter/X': '#1d9bf0',
  Facebook: '#1877f2',
  Other: '#6b7280',
};

const EMPTY_FORM = {
  name: '',
  platform: 'Discord',
  tone: 'Peer-to-peer',
  notes: '',
  discordWebhook: '',
};

export default function Communities() {
  const { communities, setCommunities } = useApp();
  const [form, setForm] = useState(EMPTY_FORM);
  const [nameError, setNameError] = useState(false);

  const handleField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'name' && value.trim()) setNameError(false);
  };

  const handleAdd = () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    const newCommunity = {
      id: Date.now().toString(),
      name: form.name.trim(),
      platform: form.platform,
      tone: form.tone,
      notes: form.notes.trim(),
      discordWebhook: form.discordWebhook.trim(),
    };
    setCommunities([...(communities || []), newCommunity]);
    setForm(EMPTY_FORM);
  };

  const handleDelete = (id) => {
    setCommunities((communities || []).filter(c => c.id !== id));
  };

  const list = communities || [];

  return (
    <div>
      <h1 className="page-title">Communities</h1>

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">
              Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              className="form-input"
              type="text"
              value={form.name}
              onChange={e => handleField('name', e.target.value)}
              placeholder="Indie Hackers"
              style={nameError ? { borderColor: '#ef4444' } : undefined}
            />
            {nameError && (
              <span style={{ color: '#ef4444', fontSize: 12 }}>Name is required</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="form-label">Platform</label>
              <select
                className="form-select"
                value={form.platform}
                onChange={e => handleField('platform', e.target.value)}
              >
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="form-label">Tone</label>
              <select
                className="form-select"
                value={form.tone}
                onChange={e => handleField('tone', e.target.value)}
              >
                {TONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.notes}
              onChange={e => handleField('notes', e.target.value)}
              placeholder="Describe this community and how you want to show up"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Discord Webhook URL</label>
            <input
              className="form-input"
              type="url"
              value={form.discordWebhook}
              onChange={e => handleField('discordWebhook', e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
            />
          </div>

          <div>
            <button className="btn btn-primary" onClick={handleAdd}>
              <Plus size={16} /> Add Community
            </button>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--muted)',
            fontSize: 14,
          }}
        >
          <Users size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
          <div>No communities yet. Add one above.</div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
          }}
        >
          {list.map(c => {
            const hasWebhook = !!(c.discordWebhook && c.discordWebhook.trim());
            const notesPreview = (c.notes || '').length > 80
              ? (c.notes || '').slice(0, 80) + '…'
              : (c.notes || '');
            const platformColor = PLATFORM_COLORS[c.platform] || PLATFORM_COLORS.Other;

            return (
              <div key={c.id} className="card" style={{ marginBottom: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{c.name}</h3>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDelete(c.id)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: platformColor + '22',
                      color: platformColor,
                      fontSize: 11,
                      fontWeight: 600,
                      border: `1px solid ${platformColor}55`,
                    }}
                  >
                    {c.platform}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.tone}</span>
                </div>

                {notesPreview && (
                  <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 12, lineHeight: 1.5 }}>
                    {notesPreview}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: hasWebhook ? '#10b981' : '#6b7280',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ color: 'var(--muted)' }}>
                    {hasWebhook ? 'Connected' : 'No webhook'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
