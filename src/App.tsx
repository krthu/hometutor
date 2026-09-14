import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { AppStateProvider, useAppState } from '@/state/AppState';
import { Home } from '@/routes/Home';
import { Subject } from '@/routes/Subject';
import { SessionRunner } from '@/routes/SessionRunner';
import { Result } from '@/routes/Result';
import { Notes } from '@/routes/Notes';
import { ProgressScreen } from '@/routes/Progress';
import { ImportScreen } from '@/routes/Import';
import { sv } from '@/i18n/sv';
import { Banner } from '@/components/ui';

/**
 * HashRouter rather than BrowserRouter: the built bundle has to work from any
 * static host, any sub-path, and from file:// without server-side rewrite rules.
 * A hash route needs none of that.
 */

/** The tab bar is hidden mid-session so nothing competes with the question. */
function TabBar() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/kor/')) return null;

  const tabs = [
    { to: '/', label: sv.nav.home, icon: '⌂' },
    { to: '/framsteg', label: sv.progress.title, icon: '◔' },
  ];

  return (
    <nav className="sticky bottom-0 z-10 border-t border-[var(--border)] bg-[var(--bg-raised)] pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-2xl">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold"
              style={({ isActive }) => ({ color: isActive ? 'var(--accent)' : 'var(--text-muted)' })}
            >
              <span aria-hidden className="text-lg leading-none">
                {tab.icon}
              </span>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function StorageWarning() {
  const { storageError } = useAppState();
  if (!storageError) return null;
  return (
    <div className="mx-auto max-w-2xl px-4 pt-4">
      <Banner tone="error">{sv.data.errors.storageFull}</Banner>
    </div>
  );
}

function Shell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <StorageWarning />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/amne/:packId" element={<Subject />} />
          <Route path="/kor/:packId" element={<SessionRunner />} />
          <Route path="/resultat/:attemptId" element={<Result />} />
          <Route path="/las/:packId" element={<Notes />} />
          <Route path="/framsteg" element={<ProgressScreen />} />
          <Route path="/import" element={<ImportScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}

export function App() {
  return (
    <AppStateProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppStateProvider>
  );
}
