import { useState, useEffect } from 'react';
import { Sparkles, Users, Package, Clock, Hammer, Send, BarChart2, Calendar, Settings as SettingsIcon, AlertCircle, X, AlertTriangle } from 'lucide-react';
import { getUnresolvedCount } from './lib/failureLog';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import Communities from './pages/Communities';
import ProductHub from './pages/ProductHub';
import History from './pages/History';
import Automation from './pages/Automation';
import ContentCalendar from './pages/ContentCalendar';
import Settings from './pages/Settings';

const PAGE_COMPONENTS = {
  dashboard: Dashboard,
  generator: Generator,
  communities: Communities,
  product: ProductHub,
  automation: Automation,
  calendar: ContentCalendar,
  history: History,
  settings: Settings,
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
  { id: 'generator', label: 'Generator', icon: Sparkles },
  { id: 'communities', label: 'Communities', icon: Users },
  { id: 'product', label: 'Product Hub', icon: Package },
  { id: 'automation', label: 'Automation', icon: Send },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function getLastActivityDate() {
  // Check history and post log for most recent date
  const history = JSON.parse(localStorage.getItem('postforge_history') || '[]');
  const postLog = JSON.parse(localStorage.getItem('postforge_post_log') || '[]');
  const dates = [
    ...history.map(h => h.date),
    ...postLog.map(l => l.date),
  ].filter(Boolean).map(d => new Date(d).getTime());
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates));
}

function getBurnoutSettings() {
  const data = localStorage.getItem('postforge_settings');
  if (!data) return { burnoutEnabled: true, burnoutDays: 7 };
  const s = JSON.parse(data);
  return { burnoutEnabled: s.burnoutEnabled !== false, burnoutDays: s.burnoutDays || 7 };
}

function isDismissedToday() {
  const dismissed = localStorage.getItem('postforge_burnout_dismissed');
  if (!dismissed) return false;
  return dismissed === new Date().toISOString().split('T')[0];
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [navPayload, setNavPayload] = useState(null);
  const [showBurnout, setShowBurnout] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(0);
  const [failureCount, setFailureCount] = useState(0);

  const navigateTo = (pageId, payload) => {
    setNavPayload(payload || null);
    setPage(pageId);
  };

  // Check failures and burnout on mount/page change
  useEffect(() => {
    setFailureCount(getUnresolvedCount());
    const { burnoutEnabled, burnoutDays } = getBurnoutSettings();
    if (!burnoutEnabled || isDismissedToday()) return;

    const lastActivity = getLastActivityDate();
    if (!lastActivity) return;

    const days = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    if (days >= burnoutDays) {
      setInactiveDays(days);
      setShowBurnout(true);
    }
  }, [page]);

  const handleDismissBurnout = () => {
    localStorage.setItem('postforge_burnout_dismissed', new Date().toISOString().split('T')[0]);
    setShowBurnout(false);
  };

  const handleGenerateCheckin = () => {
    setShowBurnout(false);
    localStorage.setItem('postforge_burnout_dismissed', new Date().toISOString().split('T')[0]);
    navigateTo('generator', {
      checkin: true,
      postType: 'Tips & Value',
      prefillContext: 'Quick check-in with the community — share where things are at this week',
    });
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
        {failureCount > 0 && (
          <div className="fl-global-banner" onClick={() => navigateTo('automation')}>
            <AlertTriangle size={15} />
            <span><strong>{failureCount} post{failureCount !== 1 ? 's' : ''}</strong> failed to send — view details in Automation</span>
          </div>
        )}
        {showBurnout && (
          <div className="burnout-banner">
            <div className="burnout-banner-content">
              <AlertCircle size={18} />
              <div>
                <div className="burnout-banner-text">
                  You haven't posted in <strong>{inactiveDays} days</strong>. Want PostForge to generate a quick check-in post?
                </div>
              </div>
            </div>
            <div className="burnout-banner-actions">
              <button className="btn btn-primary btn-sm" onClick={handleGenerateCheckin}>
                <Sparkles size={14} />
                Generate Check-in
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleDismissBurnout}>
                <X size={14} />
                Dismiss for today
              </button>
            </div>
          </div>
        )}
        <PageComponent navigateTo={navigateTo} navPayload={navPayload} />
      </main>
    </>
  );
}
