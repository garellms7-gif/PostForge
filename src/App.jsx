// PostForge v1.0
import { useState } from 'react';
import { Zap, Users, Box, Clock, Settings as SettingsIcon } from 'lucide-react';
import Generator from './pages/Generator';
import Communities from './pages/Communities';
import ProductHub from './pages/ProductHub';
import History from './pages/History';
import Settings from './pages/Settings';

const NAV = [
  { id: 'generator', label: 'Generator', icon: Zap, component: Generator },
  { id: 'communities', label: 'Communities', icon: Users, component: Communities },
  { id: 'product', label: 'Product Hub', icon: Box, component: ProductHub },
  { id: 'history', label: 'History', icon: Clock, component: History },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, component: Settings },
];

export default function App() {
  const [page, setPage] = useState('generator');
  const PageComponent = NAV.find(n => n.id === page).component;

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">PostForge</div>
        <nav className="sidebar-nav">
          {NAV.map(n => {
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                className={`sidebar-link ${page === n.id ? 'active' : ''}`}
                onClick={() => setPage(n.id)}
              >
                <Icon size={18} />
                {n.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="main-content">
        <PageComponent />
      </main>
    </>
  );
}
