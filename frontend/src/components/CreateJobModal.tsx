import { useEffect, useState } from 'react';
import { Database, LineChart, Mail, Radio, Trash2 } from 'lucide-react';
import { JOB_TYPES, PRIORITIES, type JobPriority, type JobType } from '../lib/types';
import { priorityLabel, typeLabel } from '../hooks/useJobs';
import { cn } from '../lib/cn';
import { Overlay, Spinner } from './ui';

const typeMeta: Record<JobType, { icon: typeof Mail; copy: string }> = {
  email: { icon: Mail, copy: 'Send a message to customers or the team' },
  report: { icon: LineChart, copy: 'Build a spreadsheet or snapshot' },
  ingest: { icon: Database, copy: 'Bring a file or feed into the system' },
  webhook: { icon: Radio, copy: 'Notify another tool' },
  cleanup: { icon: Trash2, copy: 'Clear old records' },
};

interface CreateJobModalProps {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    type: JobType;
    priority: JobPriority;
    notes?: string;
  }) => Promise<void>;
}

export function CreateJobModal({
  open,
  pending,
  onClose,
  onSubmit,
}: CreateJobModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<JobType>('email');
  const [priority, setPriority] = useState<JobPriority>('normal');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setType('email');
      setPriority('normal');
      setNotes('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <Overlay onClose={onClose}>
      <form
        className="modal"
        onSubmit={async (event) => {
          event.preventDefault();
          if (title.trim().length < 3) {
            setError('Title needs at least 3 characters.');
            return;
          }
          try {
            await onSubmit({
              title: title.trim(),
              type,
              priority,
              notes: notes.trim() || undefined,
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not create job');
          }
        }}
      >
        <p className="eyebrow">New work</p>
        <h2>Create a job</h2>
        <p className="modal__lede">It starts in the queue as waiting, until someone starts it.</p>

        <label className="field">
          <span>Title</span>
          <input
            autoFocus
            value={title}
            maxLength={120}
            placeholder="Send Friday report to finance"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <fieldset className="type-grid">
          <legend>Type</legend>
          {JOB_TYPES.map((item) => {
            const Icon = typeMeta[item].icon;
            return (
              <button
                key={item}
                type="button"
                className={cn('type-card', type === item && 'is-active')}
                onClick={() => setType(item)}
              >
                <Icon size={16} />
                <span>{typeLabel[item]}</span>
                <small>{typeMeta[item].copy}</small>
              </button>
            );
          })}
        </fieldset>

        <div className="field">
          <span>Priority</span>
          <div className="priority-picks">
            {PRIORITIES.map((item) => (
              <button
                key={item}
                type="button"
                className={cn('theme-pick', `priority-chip--${item}`, priority === item && 'is-active')}
                onClick={() => setPriority(item)}
              >
                {priorityLabel[item]}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Notes (optional)</span>
          <textarea
            value={notes}
            maxLength={400}
            rows={3}
            placeholder="Anything the next person should know"
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="modal__actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={pending}>
            {pending ? <Spinner /> : null}
            Add to queue
          </button>
        </div>
      </form>
    </Overlay>
  );
}
