import { useState } from 'react';
import Generator from './pages/Generator';
import Communities from './pages/Communities';
import ProductHub from './pages/ProductHub';
import History from './pages/History';
import Settings from './pages/Settings';

const NAV = [
  { id: 'generator', label: 'Generator', component: Generator },
  { id: 'communities', label: 'Communities', component: Communities },
  { id: 'product', label: 'Product Hub', component: ProductHub },
  { id: 'history', label: 'History', component: History },
  { id: 'settings', label: 'Settings', component: Settings },
];

export default function App() {
  const [page, setPage] = useState('generator');
  const PageComponent = NAV.find(n => n.id === page).component;

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">PostForge</div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <button
              key={n.id}
              className={`sidebar-link ${page === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              {n.label}
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
