import { useState, useEffect } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';

const PLATFORMS = ['Discord', 'Reddit', 'Facebook', 'Slack', 'X', 'Other'];

export default function Communities() {
  const [communities, setCommunities] = useState([]);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('Discord');

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
    save([...communities, { id: Date.now(), name: name.trim(), platform }]);
    setName('');
    setPlatform('Discord');
  };

  const handleDelete = (id) => {
    save(communities.filter(c => c.id !== id));
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
            {communities.map(c => (
              <div key={c.id} className="community-item">
                <div className="community-info">
                  <span className={`platform-badge ${c.platform.toLowerCase()}`}>
                    {c.platform}
                  </span>
                  <span className="community-name">{c.name}</span>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
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
