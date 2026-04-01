import { useState } from 'react';
import { Sparkles, Users, Package, Clock, Hammer } from 'lucide-react';
import Generator from './pages/Generator';
import Communities from './pages/Communities';
import ProductHub from './pages/ProductHub';
import History from './pages/History';

const PAGES = [
  { id: 'generator', label: 'Generator', icon: Sparkles, component: Generator },
  { id: 'communities', label: 'Communities', icon: Users, component: Communities },
  { id: 'product', label: 'Product Hub', icon: Package, component: ProductHub },
  { id: 'history', label: 'History', icon: Clock, component: History },
];

export default function App() {
  const [page, setPage] = useState('generator');
  const current = PAGES.find(p => p.id === page);
  const PageComponent = current.component;

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Hammer size={22} className="logo-icon" />
          PostForge
        </div>
        <nav className="sidebar-nav">
          {PAGES.map(p => (
            <button
              key={p.id}
              className={`sidebar-link ${page === p.id ? 'active' : ''}`}
              onClick={() => setPage(p.id)}
            >
              <p.icon size={18} />
              {p.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <PageComponent />
      </main>
    </>
  );
}
