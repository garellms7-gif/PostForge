import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Plus, Trash2, Package, Power } from 'lucide-react';
import { generatePost, resolveActiveBlocks, TONES, POST_TYPES } from '../lib/generatePost';
import { postToPlatform } from '../lib/posting';

const EMPTY_PRODUCT = {
  name: '',
  tagline: '',
  description: '',
  price: '',
  gumroadLink: '',
  version: '',
};

function getProducts() {
  return JSON.parse(localStorage.getItem('postforge_products') || '[]');
}

function saveProducts(products) {
  localStorage.setItem('postforge_products', JSON.stringify(products));
}

function getAllCommunities() {
  return JSON.parse(localStorage.getItem('postforge_communities') || '[]');
}

function getPostLog() {
  return JSON.parse(localStorage.getItem('postforge_post_log') || '[]');
}

function savePostLog(log) {
  localStorage.setItem('postforge_post_log', JSON.stringify(log));
}

function addLogEntry(entry) {
  const log = getPostLog();
  savePostLog([entry, ...log].slice(0, 100));
}

function getQueue() {
  return JSON.parse(localStorage.getItem('postforge_approval_queue') || '[]');
}

function saveQueue(queue) {
  localStorage.setItem('postforge_approval_queue', JSON.stringify(queue));
}

export default function ProductHub() {
  const [tab, setTab] = useState('edit');
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [activeProductId, setActiveProductId] = useState(null);
  const [products, setProducts] = useState([]);
  const [saved, setSaved] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const smartTimerRef = useRef(null);

  useEffect(() => {
    const data = localStorage.getItem('postforge_product');
    if (data) setProduct(JSON.parse(data));
    const activeId = localStorage.getItem('postforge_active_product_id');
    if (activeId) setActiveProductId(activeId);
    setProducts(getProducts());
  }, []);

  // Smart Mode timer for activated products
  const runSmartModeForProduct = useCallback((prod) => {
    const communities = getAllCommunities().filter(c => c.autoPost);
    if (communities.length === 0) return;
    const blocks = prod.blocks || null;
    const tone = 'Casual';
    const postType = 'Launch Announcement';

    // Generate posts and add to approval queue
    const newItems = communities.map(community => {
      const activeFlags = blocks ? resolveActiveBlocks(blocks, community) : {};
      return {
        id: Date.now() + Math.random(),
        community: community.name,
        communityId: community.id,
        platform: community.platform,
        productId: prod.id,
        productName: prod.name,
        content: generatePost(prod, community, tone, postType, blocks, activeFlags),
        status: 'pending',
        date: new Date().toISOString(),
      };
    });

    const updated = [...newItems, ...getQueue()];
    saveQueue(updated);

    // Auto-send approved items for this product
    const approved = updated.filter(q => q.status === 'approved' && q.productId === prod.id);
    approved.forEach(async (item) => {
      const community = getAllCommunities().find(c => c.id === item.communityId);
      if (!community) return;
      let status = 'success';
      let error = '';
      try {
        await postToPlatform(community, item.content);
      } catch (err) {
        status = 'failed';
        error = err.message;
      }
      addLogEntry({
        id: Date.now() + Math.random(),
        community: item.community,
        platform: item.platform,
        productName: prod.name,
        content: item.content.slice(0, 120) + (item.content.length > 120 ? '...' : ''),
        status,
        error,
        date: new Date().toISOString(),
      });
      const q = getQueue().filter(q => q.id !== item.id);
      saveQueue(q);
    });
  }, []);

  // Run Smart Mode timer for any activated product
  useEffect(() => {
    if (smartTimerRef.current) clearInterval(smartTimerRef.current);

    const activatedProducts = products.filter(p => p.activated);
    if (activatedProducts.length === 0) return;

    smartTimerRef.current = setInterval(() => {
      const now = new Date();
      for (const prod of activatedProducts) {
        const time = prod.smartTime || '09:00';
        const [h, m] = time.split(':').map(Number);
        if (now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 10) {
          runSmartModeForProduct(prod);
        }
      }
    }, 5000);

    return () => clearInterval(smartTimerRef.current);
  }, [products, runSmartModeForProduct]);

  const update = (field, value) => {
    setProduct(prev => ({ ...prev, [field]: value }));
  };

  const persistActive = (prod, id) => {
    localStorage.setItem('postforge_product', JSON.stringify(prod));
    if (id) localStorage.setItem('postforge_active_product_id', id);
    // Also persist blocks from the product for Generator/Automation compatibility
    const prods = getProducts();
    const found = prods.find(p => p.id === id);
    if (found?.blocks) {
      localStorage.setItem('postforge_blocks', JSON.stringify(found.blocks));
    }
  };

  const handleSave = () => {
    persistActive(product, activeProductId);
    if (activeProductId) {
      const updated = getProducts().map(p =>
        p.id === activeProductId ? { ...p, ...product } : p
      );
      saveProducts(updated);
      setProducts(updated);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveAsNew = () => {
    const id = String(Date.now());
    const entry = { ...product, id, blocks: null, activated: false, smartTime: '09:00' };
    const updated = [...getProducts(), entry];
    saveProducts(updated);
    setProducts(updated);
    setActiveProductId(id);
    persistActive(product, id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLoad = (p) => {
    const loadedProduct = {
      name: p.name || '',
      tagline: p.tagline || '',
      description: p.description || '',
      price: p.price || '',
      gumroadLink: p.gumroadLink || '',
      version: p.version || '',
    };
    setProduct(loadedProduct);
    setActiveProductId(p.id);
    persistActive(loadedProduct, p.id);
    setTab('edit');
  };

  const handleDeleteProduct = (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    const updated = getProducts().filter(p => p.id !== id);
    saveProducts(updated);
    setProducts(updated);
    setConfirmDeleteId(null);
    if (activeProductId === id) {
      setActiveProductId(null);
      localStorage.removeItem('postforge_active_product_id');
    }
  };

  const handleToggleActivate = (id) => {
    const updated = getProducts().map(p => {
      if (p.id === id) {
        return { ...p, activated: !p.activated };
      }
      // Deactivate all others — only one active at a time
      return { ...p, activated: false };
    });
    saveProducts(updated);
    setProducts(updated);

    // If we just activated this product, also load it as the active product
    const activated = updated.find(p => p.id === id);
    if (activated?.activated) {
      setActiveProductId(id);
      const loadedProduct = {
        name: activated.name || '',
        tagline: activated.tagline || '',
        description: activated.description || '',
        price: activated.price || '',
        gumroadLink: activated.gumroadLink || '',
        version: activated.version || '',
      };
      setProduct(loadedProduct);
      persistActive(loadedProduct, id);
    }
  };

  const handleSmartTimeChange = (id, time) => {
    const updated = getProducts().map(p =>
      p.id === id ? { ...p, smartTime: time } : p
    );
    saveProducts(updated);
    setProducts(updated);
  };

  return (
    <div>
      <h1 className="page-title">Product Hub</h1>
      <p className="page-subtitle">Manage your products and activate Smart Mode automation.</p>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'edit' ? 'tab-active' : ''}`} onClick={() => setTab('edit')}>
          Edit Product
        </button>
        <button className={`tab-btn ${tab === 'library' ? 'tab-active' : ''}`} onClick={() => setTab('library')}>
          My Products
          {products.length > 0 && <span className="tab-count">{products.length}</span>}
        </button>
      </div>

      {/* ===== Edit Product Tab ===== */}
      {tab === 'edit' && (
        <div className="card">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Product Name</label>
              <input className="form-input" placeholder="e.g. ShipFast" value={product.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tagline</label>
              <input className="form-input" placeholder="e.g. Ship your SaaS in days, not months" value={product.tagline} onChange={e => update('tagline', e.target.value)} />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" placeholder="Describe what your product does and who it's for..." value={product.description} onChange={e => update('description', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Price</label>
              <input className="form-input" placeholder="e.g. $49" value={product.price} onChange={e => update('price', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Gumroad Link</label>
              <input className="form-input" placeholder="e.g. https://you.gumroad.com/product" value={product.gumroadLink} onChange={e => update('gumroadLink', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Version</label>
              <input className="form-input" placeholder="e.g. 1.0.0" value={product.version} onChange={e => update('version', e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeProductId && (
              <button className="btn btn-primary" onClick={handleSave}>
                <Save size={16} />
                Save
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleSaveAsNew}>
              <Plus size={16} />
              Save as New Product
            </button>
            {saved && <span className="status-msg">Saved!</span>}
          </div>
        </div>
      )}

      {/* ===== My Products Tab ===== */}
      {tab === 'library' && (
        <>
          {products.length > 0 ? (
            <div className="product-grid">
              {products.map(p => {
                const isActive = activeProductId === p.id;
                const isActivated = p.activated || false;
                return (
                  <div
                    key={p.id}
                    className={`product-card ${isActive ? 'product-card-active' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="product-card-name">{p.name || 'Untitled Product'}</div>
                      {isActivated && (
                        <span className="product-activated-badge">Smart Mode On</span>
                      )}
                    </div>
                    {p.tagline && <div className="product-card-tagline">{p.tagline}</div>}
                    <div className="product-card-meta">
                      {p.price && <span className="product-card-chip">{p.price}</span>}
                      {p.version && <span className="product-card-chip">v{p.version}</span>}
                    </div>

                    {isActivated && (
                      <div className="product-smart-time">
                        <label className="form-label">Smart Mode Time</label>
                        <input
                          className="form-input"
                          type="time"
                          value={p.smartTime || '09:00'}
                          onChange={e => handleSmartTimeChange(p.id, e.target.value)}
                          style={{ padding: '6px 10px', fontSize: 13 }}
                        />
                      </div>
                    )}

                    <div className="product-card-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => handleLoad(p)}>
                        Load
                      </button>
                      <button
                        className={`btn btn-sm ${isActivated ? 'btn-activate-on' : 'btn-activate-off'}`}
                        onClick={() => handleToggleActivate(p.id)}
                      >
                        <Power size={14} />
                        {isActivated ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteProduct(p.id)}
                      >
                        <Trash2 size={14} />
                        {confirmDeleteId === p.id ? 'Confirm?' : ''}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <Package size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>No products saved yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
