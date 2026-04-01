import { useState } from 'react';
import { Sparkles, Users, Package, Clock, Hammer, Send } from 'lucide-react';
import Generator from './pages/Generator';
import Communities from './pages/Communities';
import ProductHub from './pages/ProductHub';
import History from './pages/History';
import Automation from './pages/Automation';

const PAGE_COMPONENTS = {
  generator: Generator,
  communities: Communities,
  product: ProductHub,
  automation: Automation,
  history: History,
};

const NAV_ITEMS = [
  { id: 'generator', label: 'Generator', icon: Sparkles },
  { id: 'communities', label: 'Communities', icon: Users },
  { id: 'product', label: 'Product Hub', icon: Package },
  { id: 'automation', label: 'Automation', icon: Send },
  { id: 'history', label: 'History', icon: Clock },
];

export default function App() {
  const [page, setPage] = useState('generator');
  const [navPayload, setNavPayload] = useState(null);

  const navigateTo = (pageId, payload) => {
    setNavPayload(payload || null);
    setPage(pageId);
  };

  const PageComponent = PAGE_COMPONENTS[page];

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Hammer size={22} className="logo-icon" />
          PostForge
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(p => (
            <button
              key={p.id}
              className={`sidebar-link ${page === p.id ? 'active' : ''}`}
              onClick={() => navigateTo(p.id)}
            >
              <p.icon size={18} />
              {p.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <PageComponent navigateTo={navigateTo} navPayload={navPayload} />
      </main>
    </>
  );
}
