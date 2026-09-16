import { createContext, useContext, type ReactNode } from 'react';

interface WorkspaceContextValue {
  operator: string;
  openCreate: () => void;
  live: boolean;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  operator,
  openCreate,
  live,
  sidebarOpen,
  toggleSidebar,
  closeSidebar,
  children,
}: WorkspaceContextValue & { children: ReactNode }) {
  return (
    <WorkspaceContext.Provider
      value={{ operator, openCreate, live, sidebarOpen, toggleSidebar, closeSidebar }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

