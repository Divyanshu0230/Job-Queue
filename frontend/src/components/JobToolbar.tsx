import { Download, Search, SlidersHorizontal } from 'lucide-react';
import { Kbd } from './ui';
import { JOB_TYPES, PRIORITIES, type JobPriority, type JobSort, type JobType } from '../lib/types';
import { priorityLabel, typeLabel } from '../hooks/useJobs';
import { cn } from '../lib/cn';

interface JobToolbarProps {
  search: string;
  type: JobType | 'all';
  priority: JobPriority | 'all';
  sort: JobSort;
  attention: boolean;
  watchedOnly: boolean;
  total: number;
  onSearch: (value: string) => void;
  onType: (value: JobType | 'all') => void;
  onPriority: (value: JobPriority | 'all') => void;
  onSort: (value: JobSort) => void;
  onAttention: (value: boolean) => void;
  onWatchedOnly: (value: boolean) => void;
  onExport: () => void;
}

export function JobToolbar({
  search,
  type,
  priority,
  sort,
  attention,
  watchedOnly,
  total,
  onSearch,
  onType,
  onPriority,
  onSort,
  onAttention,
  onWatchedOnly,
  onExport,
}: JobToolbarProps) {
  return (
    <div className="toolbar">
      <label className="search">
        <Search size={16} />
        <input
          id="job-search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search title or notes"
        />
        <Kbd>/</Kbd>
      </label>
      <label className="select-wrap">
        <SlidersHorizontal size={14} />
        <select
          value={type}
          onChange={(event) => onType(event.target.value as JobType | 'all')}
        >
          <option value="all">All types</option>
          {JOB_TYPES.map((item) => (
            <option key={item} value={item}>
              {typeLabel[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="select-wrap">
        <select
          value={priority}
          onChange={(event) => onPriority(event.target.value as JobPriority | 'all')}
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {priorityLabel[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="select-wrap">
        <select value={sort} onChange={(event) => onSort(event.target.value as JobSort)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="priority">Urgent first</option>
        </select>
      </label>
      <button
        type="button"
        className={cn('chip-btn', attention && 'is-active')}
        onClick={() => onAttention(!attention)}
      >
        Needs a look
      </button>
      <button
        type="button"
        className={cn('chip-btn', watchedOnly && 'is-active')}
        onClick={() => onWatchedOnly(!watchedOnly)}
      >
        Watched
      </button>
      <button type="button" className="ghost-btn" onClick={onExport}>
        <Download size={14} />
        Export
      </button>
      <p className="toolbar__meta">{total} matching</p>
    </div>
  );
}
