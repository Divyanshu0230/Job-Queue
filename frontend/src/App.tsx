import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Sidebar, Topbar } from './components/Chrome';
import { CreateJobModal } from './components/CreateJobModal';
import { Toasts } from './components/Toasts';
import { useCreateJob } from './hooks/useJobs';
import { useJobStream } from './hooks/useJobStream';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider, useToasts } from './hooks/useToasts';
import { WorkspaceProvider } from './hooks/useWorkspace';
import { fetchHealth } from './lib/api';
import { cn } from './lib/cn';
import { ActivityPage } from './pages/ActivityPage';
import { HomePage } from './pages/HomePage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';
import { readDensity, readOperator, SettingsPage } from './pages/SettingsPage';

function Shell() {
  const { push } = useToasts();
  const live = useJobStream();
  const createJob = useCreateJob();
  const [createOpen, setCreateOpen] = useState(false);
  const [operator, setOperator] = useState(() =>
    typeof window === 'undefined' ? 'You' : readOperator(),
  );
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('jobqueue.sidebar');
    if (saved === 'hidden') return false;
    if (saved === 'open') return true;
    return window.innerWidth > 980;
  });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 980,
  );
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 20_000,
    retry: 1,
  });

  useEffect(() => {
    document.documentElement.dataset.density = readDensity();
  }, []);

  useEffect(() => {
    localStorage.setItem('jobqueue.sidebar', sidebarOpen ? 'open' : 'hidden');
  }, [sidebarOpen]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 980px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT';
      if (event.key === 'Escape') {
        setCreateOpen(false);
        if (window.innerWidth <= 980) setSidebarOpen(false);
      }
      if (!typing && (event.key === 'n' || event.key === 'N')) {
        event.preventDefault();
        setCreateOpen(true);
      }
      if (!typing && event.key === '/') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.search--top input')?.focus();
      }
      if (!typing && event.key === '?') {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>('button[aria-label="Shortcuts"]')?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <WorkspaceProvider
      operator={operator}
      live={live}
      openCreate={() => setCreateOpen(true)}
      sidebarOpen={sidebarOpen}
      toggleSidebar={() => setSidebarOpen((value) => !value)}
      closeSidebar={() => setSidebarOpen(false)}
    >
      <div className={cn('app', sidebarOpen ? 'is-nav-open' : 'is-nav-closed')}>
        <div className="shell__glow" />
        {sidebarOpen && isMobile ? (
          <button
            type="button"
            className="nav-scrim"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        {sidebarOpen ? <Sidebar /> : null}
        <div className="app__main">
          <Topbar
            live={live}
            apiOk={health.isSuccess ? true : health.isError ? false : null}
          />
          <div className="app__content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/queue" element={<JobsPage />} />
              <Route path="/queue/:id" element={<JobDetailPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route
                path="/settings"
                element={<SettingsPage operator={operator} onOperator={setOperator} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </div>

      <CreateJobModal
        open={createOpen}
        pending={createJob.isPending}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input) => {
          const job = await createJob.mutateAsync(input);
          setCreateOpen(false);
          push({ tone: 'ok', title: 'Job queued', detail: job.title });
        }}
      />
      <Toasts />
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
