import type { ReactNode } from 'react';
import type { JobPriority, JobStatus } from '../lib/types';
import { cn } from '../lib/cn';
import { priorityWord, statusWord } from '../lib/format';

export const statusCopy: Record<JobStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={cn('status-pill', `status-pill--${status}`)}>
      {status === 'running' ? <span className="pulse-dot" /> : <span className="static-dot" />}
      {statusWord[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: JobPriority }) {
  return (
    <span className={cn('priority-chip', `priority-chip--${priority}`)}>
      {priorityWord[priority]}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('spinner', className)} aria-hidden />;
}

export function Overlay({
  children,
  onClose,
  className,
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className={cn('overlay', className)} role="presentation">
      <button className="overlay__backdrop" aria-label="Close" onClick={onClose} />
      {children}
    </div>
  );
}
