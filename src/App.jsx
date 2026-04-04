import { useState, useEffect } from 'react';
import { Sparkles, Users, Package, Clock, Hammer, Send, BarChart2, Calendar, Settings as SettingsIcon, AlertCircle, X, AlertTriangle, Rocket } from 'lucide-react';
import { getUnresolvedCount } from './lib/failureLog';
import { getExpiringCredCount } from './lib/credentialExpiry';
import { safeGet, safeSetRaw, safeGetRaw } from './lib/safeStorage';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import Communities from './pages/Communities';
import ProductHub from './pages/ProductHub';
import History from './pages/History';
import Automation from './pages/Automation';
import ContentCalendar from './pages/ContentCalendar';
import Settings from './pages/Settings';
import { UndoManager } from './components/UndoManager';

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

const ALL_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart2, advanced: true },
  { id: 'generator', label: 'Generator', icon: Sparkles },
  { id: 'communities', label: 'Communities', icon: Users },
  { id: 'product', label: 'Product Hub', icon: Package },
  { id: 'automation', label: 'Automation', icon: Send, advanced: true },
  { id: 'calendar', label: 'Calendar', icon: Calendar, advanced: true },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, advanced: true },
];

function getSimpleMode() {
  const raw = safeGetRaw('postforge_simple_mode', null);
  if (raw === null) return true; // Default on for new users
  return raw === 'true';
}

function getLastActivityDate() {
  const history = safeGet('postforge_history', []);
  const postLog = safeGet('postforge_post_log', []);
  const dates = [...history.map(h => h.date), ...postLog.map(l => l.date)].filter(Boolean).map(d => new Date(d).getTime());
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates));
}

function getBurnoutSettings() {
  const s = safeGet('postforge_settings', {});
  return { burnoutEnabled: s.burnoutEnabled !== false, burnoutDays: s.burnoutDays || 7 };
}

function isDismissedToday() {
  return safeGetRaw('postforge_burnout_dismissed', '') === new Date().toISOString().split('T')[0];
}

function shouldShowAdvancedHint() {
  if (safeGetRaw('postforge_advanced_hint_dismissed', '') === 'true') return false;
  const firstUse = safeGetRaw('postforge_first_use', null);
  if (!firstUse) { safeSetRaw('postforge_first_use', new Date().toISOString()); return false; }
  const daysSince = (Date.now() - new Date(firstUse).getTime()) / 86400000;
  return daysSince >= 3;
}

export default function App() {
  const [page, setPage] = useState('generator');
  const [navPayload, setNavPayload] = useState(null);
  const [showBurnout, setShowBurnout] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  const [expiringCreds, setExpiringCreds] = useState(0);
  const [simpleMode, setSimpleMode] = useState(getSimpleMode());
  const [showHint, setShowHint] = useState(false);

  const navigateTo = (pageId, payload) => {
    setNavPayload(payload || null);
    setPage(pageId);
  };

  useEffect(() => {
    setFailureCount(getUnresolvedCount());
    setExpiringCreds(getExpiringCredCount());
    if (simpleMode && shouldShowAdvancedHint()) setShowHint(true);

    const { burnoutEnabled, burnoutDays } = getBurnoutSettings();
    if (!burnoutEnabled || isDismissedToday()) return;
    const lastActivity = getLastActivityDate();
    if (!lastActivity) return;
    const days = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);
    if (days >= burnoutDays) { setInactiveDays(days); setShowBurnout(true); }
  }, [page, simpleMode]);

  // Listen for simple mode changes from Settings
  useEffect(() => {
    const onStorage = () => setSimpleMode(getSimpleMode());
    window.addEventListener('storage', onStorage);
    const interval = setInterval(() => {
      const current = getSimpleMode();
      if (current !== simpleMode) setSimpleMode(current);
    }, 1000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(interval); };
  }, [simpleMode]);

  const handleDismissBurnout = () => { safeSetRaw('postforge_burnout_dismissed', new Date().toISOString().split('T')[0]); setShowBurnout(false); };
  const handleGenerateCheckin = () => { setShowBurnout(false); safeSetRaw('postforge_burnout_dismissed', new Date().toISOString().split('T')[0]); navigateTo('generator', { checkin: true, postType: 'Tips & Value' }); };
  const handleDismissHint = () => { safeSetRaw('postforge_advanced_hint_dismissed', 'true'); setShowHint(false); };

  const navItems = simpleMode ? ALL_NAV.filter(n => !n.advanced) : ALL_NAV;

  // If current page is hidden in simple mode, redirect to generator
  useEffect(() => {
    if (simpleMode && ALL_NAV.find(n => n.id === page)?.advanced) setPage('generator');
  }, [simpleMode, page]);

  const PageComponent = PAGE_COMPONENTS[page];

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Hammer size={22} className="logo-icon" />
          PostForge
        </div>
        <nav className="sidebar-nav">
          {navItems.map(p => (
            <button key={p.id} className={`sidebar-link ${page === p.id ? 'active' : ''}`} onClick={() => navigateTo(p.id)}>
              <p.icon size={18} />
              {p.label}
            </button>
          ))}
        </nav>
        {/* Settings gear at bottom in simple mode */}
        {simpleMode && (
          <div className="sidebar-bottom">
            <button className="sidebar-link" onClick={() => navigateTo('settings')} style={{ marginTop: 'auto' }}>
              <SettingsIcon size={18} />
              Settings
            </button>
          </div>
        )}
      </aside>
      <main className="main-content">
        {failureCount > 0 && (
          <div className="fl-global-banner" onClick={() => navigateTo('automation')}>
            <AlertTriangle size={15} />
            <span><strong>{failureCount} post{failureCount !== 1 ? 's' : ''}</strong> failed to send — view details in Automation</span>
          </div>
        )}
        {expiringCreds > 0 && (
          <div className="ce-global-banner" onClick={() => navigateTo('settings')}>
            <AlertTriangle size={15} />
            <span><strong>{expiringCreds} platform connection{expiringCreds !== 1 ? 's' : ''}</strong> need{expiringCreds === 1 ? 's' : ''} attention — check Credentials in Settings</span>
          </div>
        )}
        {showBurnout && (
          <div className="burnout-banner">
            <div className="burnout-banner-content">
              <AlertCircle size={18} />
              <div><div className="burnout-banner-text">You haven't posted in <strong>{inactiveDays} days</strong>. Want PostForge to generate a quick check-in post?</div></div>
            </div>
            <div className="burnout-banner-actions">
              <button className="btn btn-primary btn-sm" onClick={handleGenerateCheckin}><Sparkles size={14} /> Generate Check-in</button>
              <button className="btn btn-secondary btn-sm" onClick={handleDismissBurnout}><X size={14} /> Dismiss for today</button>
            </div>
          </div>
        )}
        <PageComponent navigateTo={navigateTo} navPayload={navPayload} simpleMode={simpleMode} />
      </main>

      <UndoManager />

      {/* Advanced mode hint */}
      {showHint && (
        <div className="sm-hint">
          <Rocket size={16} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Ready for more?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Turn off Simple Mode in Settings to unlock campaigns, analytics, automation, and more.</div>
          </div>
          <button className="sm-hint-dismiss" onClick={handleDismissHint}><X size={14} /></button>
        </div>
      )}
    </>
  );
}
