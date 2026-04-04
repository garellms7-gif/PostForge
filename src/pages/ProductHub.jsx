import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Plus, Trash2, Package, Power, BarChart2, Search, X, ChevronDown } from 'lucide-react';
import { generatePost, resolveActiveBlocks } from '../lib/generatePost';
import { postToPlatform } from '../lib/posting';
import { UndoToast } from '../components/UxHelpers';
import MyVoice from '../components/MyVoice';
import ProductAnalytics from '../components/ProductAnalytics';

const EMPTY_PRODUCT = {
  name: '',
  tagline: '',
  description: '',
  price: '',
  gumroadLink: '',
  version: '',
  tags: [],
  category: 'Other',
  status: 'Active Development',
};

const CATEGORIES = ['Tools', 'Games', 'Content', 'Services', 'Templates', 'Other'];
const STATUSES = ['Active Development', 'Launched', 'Paused', 'Archived'];
const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'posts', label: 'Most posts' },
  { value: 'oldest', label: 'Oldest' },
];

function getProducts() {
  return JSON.parse(localStorage.getItem('postforge_products') || '[]');
}

function saveProducts(products) {
  localStorage.setItem('postforge_products', JSON.stringify(products));
}

function getPostCountForProduct(name) {
  const log = JSON.parse(localStorage.getItem('postforge_post_log') || '[]');
  return log.filter(l => l.productName === name).length;
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

export default function ProductHub({ simpleMode }) {
  const [tab, setTab] = useState('edit');
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [activeProductId, setActiveProductId] = useState(null);
  const [products, setProducts] = useState([]);
  const [saved, setSaved] = useState(false);
  const [undoProduct, setUndoProduct] = useState(null);
  const [analyticsProduct, setAnalyticsProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [tagInput, setTagInput] = useState('');
  const [archiveConfirm, setArchiveConfirm] = useState(null);
  const scheduleTimerRef = useRef(null);

  useEffect(() => {
    const data = localStorage.getItem('postforge_product');
    if (data) setProduct(JSON.parse(data));
    const activeId = localStorage.getItem('postforge_active_product_id');
    if (activeId) setActiveProductId(activeId);
    setProducts(getProducts());
  }, []);

  // Scheduled Mode: generate and post immediately at the scheduled time
  const runScheduledForProduct = useCallback(async (prod) => {
    const communities = getAllCommunities().filter(c => c.autoPost);
    if (communities.length === 0) return;
    const blocks = prod.blocks || null;
    const tone = 'Casual';
    const postType = 'Launch Announcement';

    for (const community of communities) {
      const activeFlags = blocks ? resolveActiveBlocks(blocks, community) : {};
      const content = generatePost(prod, community, tone, postType, blocks, activeFlags);
      let status = 'success';
      let error = '';
      try {
        await postToPlatform(community, content);
      } catch (err) {
        status = 'failed';
        error = err.message;
      }
      addLogEntry({
        id: Date.now() + Math.random(),
        community: community.name,
        platform: community.platform,
        productName: prod.name || 'Unknown',
        content: content.slice(0, 120) + (content.length > 120 ? '...' : ''),
        status,
        error,
        date: new Date().toISOString(),
      });
    }
  }, []);

  // Timer for all activated products (independent schedules)
  useEffect(() => {
    if (scheduleTimerRef.current) clearInterval(scheduleTimerRef.current);

    const activatedProducts = products.filter(p => p.activated);
    if (activatedProducts.length === 0) return;

    scheduleTimerRef.current = setInterval(() => {
      const now = new Date();
      for (const prod of activatedProducts) {
        const time = prod.scheduleTime || '10:00';
        const [h, m] = time.split(':').map(Number);
        if (now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 10) {
          runScheduledForProduct(prod);
        }
      }
    }, 5000);

    return () => clearInterval(scheduleTimerRef.current);
  }, [products, runScheduledForProduct]);

  const update = (field, value) => {
    setProduct(prev => ({ ...prev, [field]: value }));
  };

  const persistActive = (prod, id) => {
    localStorage.setItem('postforge_product', JSON.stringify(prod));
    if (id) localStorage.setItem('postforge_active_product_id', id);
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
    const entry = { ...product, id, blocks: null, activated: false, scheduleTime: '10:00', createdAt: new Date().toISOString() };
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
    const item = products.find(p => p.id === id);
    const updated = getProducts().filter(p => p.id !== id);
    saveProducts(updated);
    setProducts(updated);
    if (activeProductId === id) {
      setActiveProductId(null);
      localStorage.removeItem('postforge_active_product_id');
    }
    setUndoProduct(item);
  };

  const handleUndoDeleteProduct = () => {
    if (!undoProduct) return;
    const updated = [...products, undoProduct];
    saveProducts(updated);
    setProducts(updated);
    setUndoProduct(null);
  };

  // Multiple products can be active simultaneously
  const handleToggleActivate = (id) => {
    const updated = getProducts().map(p => {
      if (p.id === id) {
        return { ...p, activated: !p.activated };
      }
      return p;
    });
    saveProducts(updated);
    setProducts(updated);
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || (product.tags || []).includes(tag)) { setTagInput(''); return; }
    update('tags', [...(product.tags || []), tag]);
    setTagInput('');
  };

  const handleRemoveTag = (tag) => {
    update('tags', (product.tags || []).filter(t => t !== tag));
  };

  const handleSetStatus = (id, status) => {
    if (status === 'Archived') {
      const p = products.find(pr => pr.id === id);
      if (p?.activated) {
        setArchiveConfirm(id);
        return;
      }
    }
    const updated = getProducts().map(p => p.id === id ? { ...p, status } : p);
    saveProducts(updated);
    setProducts(updated);
  };

  const handleConfirmArchive = () => {
    if (!archiveConfirm) return;
    const updated = getProducts().map(p => p.id === archiveConfirm ? { ...p, status: 'Archived', activated: false } : p);
    saveProducts(updated);
    setProducts(updated);
    setArchiveConfirm(null);
  };

  const handleScheduleTimeChange = (id, time) => {
    const updated = getProducts().map(p =>
      p.id === id ? { ...p, scheduleTime: time } : p
    );
    saveProducts(updated);
    setProducts(updated);
  };

  return (
    <div>
      <h1 className="page-title">Product Hub</h1>
      <p className="page-subtitle">Manage your products and activate scheduled automation.</p>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'edit' ? 'tab-active' : ''}`} onClick={() => setTab('edit')}>
          Edit Product
        </button>
        <button className={`tab-btn ${tab === 'library' ? 'tab-active' : ''}`} onClick={() => setTab('library')}>
          My Products
          {products.length > 0 && <span className="tab-count">{products.length}</span>}
        </button>
        {!simpleMode && <button className={`tab-btn ${tab === 'voice' ? 'tab-active' : ''}`} onClick={() => setTab('voice')}>
          My Voice
        </button>}
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
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={product.category || 'Other'} onChange={e => update('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={product.status || 'Active Development'} onChange={e => update('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group full-width">
              <label className="form-label">Tags</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input className="form-input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} placeholder="Add a tag and press Enter..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }}} />
                <button className="btn btn-secondary btn-sm" onClick={handleAddTag}>Add</button>
              </div>
              {(product.tags || []).length > 0 && (
                <div className="pl-tags">
                  {product.tags.map(t => (
                    <span key={t} className="pl-tag">{t}<button className="pl-tag-x" onClick={() => handleRemoveTag(t)}><X size={10} /></button></span>
                  ))}
                </div>
              )}
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
      {tab === 'library' && (() => {
        const activeProducts = products.filter(p => (p.status || 'Active Development') !== 'Archived');
        const archivedProducts = products.filter(p => p.status === 'Archived');

        // Filter
        let filtered = activeProducts;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(q) || (p.tags || []).some(t => t.includes(q)));
        }
        if (filterCategory) filtered = filtered.filter(p => (p.category || 'Other') === filterCategory);
        if (filterStatus) filtered = filtered.filter(p => (p.status || 'Active Development') === filterStatus);

        // Sort
        if (sortBy === 'name') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        else if (sortBy === 'posts') filtered.sort((a, b) => getPostCountForProduct(b.name) - getPostCountForProduct(a.name));
        else if (sortBy === 'oldest') filtered.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        else filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        // Stats
        const totalCount = products.length;
        const activeDevCount = products.filter(p => (p.status || 'Active Development') === 'Active Development').length;
        const launchedCount = products.filter(p => p.status === 'Launched').length;
        const archivedCount = archivedProducts.length;

        const renderCard = (p) => {
          const isLoaded = activeProductId === p.id;
          const isActivated = p.activated || false;
          const isArchived = p.status === 'Archived';
          const statusColors = { 'Active Development': 'var(--success)', 'Launched': 'var(--accent)', 'Paused': '#eab308', 'Archived': 'var(--muted)' };
          return (
            <div key={p.id} className={`product-card ${isLoaded ? 'product-card-active' : ''} ${isArchived ? 'product-card-archived' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                <div className="product-card-name">{p.name || 'Untitled Product'}</div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {isActivated && <span className="product-activated-badge">Active</span>}
                  <span className="pl-status-badge" style={{ background: (statusColors[p.status] || 'var(--muted)') + '18', color: statusColors[p.status] || 'var(--muted)' }}>{p.status || 'Active Development'}</span>
                </div>
              </div>
              {p.tagline && <div className="product-card-tagline">{p.tagline}</div>}
              <div className="product-card-meta">
                {p.price && <span className="product-card-chip">{p.price}</span>}
                {p.version && <span className="product-card-chip">v{p.version}</span>}
                {p.category && p.category !== 'Other' && <span className="product-card-chip">{p.category}</span>}
              </div>
              {(p.tags || []).length > 0 && (
                <div className="pl-tags" style={{ marginTop: 4 }}>
                  {p.tags.map(t => <span key={t} className="pl-tag-sm">{t}</span>)}
                </div>
              )}
              {isActivated && (
                <div className="product-schedule-row">
                  <span className="product-schedule-label">Posts daily at</span>
                  <input className="form-input" type="time" value={p.scheduleTime || '10:00'} onChange={e => handleScheduleTimeChange(p.id, e.target.value)} style={{ padding: '6px 10px', fontSize: 13, width: 110 }} />
                </div>
              )}
              <div className="product-card-actions">
                <button className="btn btn-primary btn-sm" onClick={() => handleLoad(p)}>Load</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setAnalyticsProduct(p)}><BarChart2 size={13} /> Analytics</button>
                {!isArchived && (
                  <button className={`btn btn-sm ${isActivated ? 'btn-activate-on' : 'btn-activate-off'}`} onClick={() => handleToggleActivate(p.id)}>
                    <Power size={14} /> {isActivated ? 'Deactivate' : 'Activate'}
                  </button>
                )}
                <select className="pl-status-select" value={p.status || 'Active Development'} onChange={e => handleSetStatus(p.id, e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProduct(p.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        };

        return (
        <>
          {products.length > 0 ? (
            <>
              {/* Quick Stats */}
              <div className="pl-quick-stats">
                <span className="pl-stat-badge">{totalCount} Total</span>
                <span className="pl-stat-badge pl-stat-active">{activeDevCount} Active Dev</span>
                <span className="pl-stat-badge pl-stat-launched">{launchedCount} Launched</span>
                {archivedCount > 0 && <span className="pl-stat-badge pl-stat-archived">{archivedCount} Archived</span>}
              </div>

              {/* Search + Filters */}
              <div className="pl-toolbar">
                <div className="pl-search">
                  <Search size={14} />
                  <input className="pl-search-input" placeholder="Search by name or tag..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  {searchQuery && <button className="pl-search-clear" onClick={() => setSearchQuery('')}><X size={12} /></button>}
                </div>
                <div className="pl-filters">
                  <select className="pl-filter-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="pl-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    {STATUSES.filter(s => s !== 'Archived').map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select className="pl-filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Products grid */}
              {filtered.length > 0 ? (
                <div className="product-grid">
                  {filtered.map(renderCard)}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 24 }}>
                  <p style={{ fontSize: 14, color: 'var(--muted)' }}>No products match your search or filters.</p>
                </div>
              )}

              {/* Archived section */}
              {archivedProducts.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>Archived ({archivedProducts.length})</div>
                  <div className="product-grid">
                    {archivedProducts.map(renderCard)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Package size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>No products saved yet.</p>
              <p style={{ marginTop: 8, fontSize: 13 }}>Switch to the Edit Product tab, fill in your product details, and click "Save as New Product".</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setTab('edit')}>Go to Edit Product</button>
            </div>
          )}
        </>
        );
      })()}

      {/* Archive confirmation */}
      {archiveConfirm && (
        <div className="pq-modal-overlay" onClick={() => setArchiveConfirm(null)}>
          <div className="pq-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Archive Product?</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              This will stop all scheduled posts for <strong>{products.find(p => p.id === archiveConfirm)?.name || 'this product'}</strong>. Continue?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setArchiveConfirm(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleConfirmArchive}>Archive & Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== My Voice Tab ===== */}
      {tab === 'voice' && <MyVoice />}

      {/* Product Analytics Panel */}
      {analyticsProduct && (
        <ProductAnalytics product={analyticsProduct} onClose={() => setAnalyticsProduct(null)} />
      )}

      {undoProduct && (
        <UndoToast
          key={undoProduct.id}
          message={`"${undoProduct.name || 'Product'}" deleted`}
          onUndo={handleUndoDeleteProduct}
        />
      )}
    </div>
  );
}
