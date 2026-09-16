import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { streamUrl } from '../lib/api';

export function useJobStream() {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const source = new EventSource(streamUrl());

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['job'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    };

    source.addEventListener('job', refresh);
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);

    return () => {
      source.close();
      setLive(false);
    };
  }, [queryClient]);

  return live;
}
