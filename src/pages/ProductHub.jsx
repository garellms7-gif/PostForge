import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

const EMPTY_PRODUCT = {
  name: '',
  tagline: '',
  description: '',
  price: '',
  gumroadLink: '',
  version: '',
};

export default function ProductHub() {
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem('postforge_product');
    if (data) setProduct(JSON.parse(data));
  }, []);

  const update = (field, value) => {
    setProduct(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    localStorage.setItem('postforge_product', JSON.stringify(product));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1 className="page-title">Product Hub</h1>
      <p className="page-subtitle">Define your product details for personalized post generation.</p>

      <div className="card">
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Product Name</label>
            <input
              className="form-input"
              placeholder="e.g. ShipFast"
              value={product.name}
              onChange={e => update('name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tagline</label>
            <input
              className="form-input"
              placeholder="e.g. Ship your SaaS in days, not months"
              value={product.tagline}
              onChange={e => update('tagline', e.target.value)}
            />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              placeholder="Describe what your product does and who it's for..."
              value={product.description}
              onChange={e => update('description', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Price</label>
            <input
              className="form-input"
              placeholder="e.g. $49"
              value={product.price}
              onChange={e => update('price', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Gumroad Link</label>
            <input
              className="form-input"
              placeholder="e.g. https://you.gumroad.com/product"
              value={product.gumroadLink}
              onChange={e => update('gumroadLink', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Version</label>
            <input
              className="form-input"
              placeholder="e.g. 1.0.0"
              value={product.version}
              onChange={e => update('version', e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} />
            Save Product
          </button>
          {saved && <span className="status-msg">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
