import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { trackListLocation } from '../../shared/lib/listMemory';

/**
 * Feeds every location change to the list memory (`shared/lib/listMemory.ts`): list pages
 * remember their query, leaving a top-level section forgets it. Mounted once, in the app shell.
 */
export function useListMemoryTracker(): void {
  const { pathname, search } = useLocation();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    trackListLocation(previous.current, pathname, search);
    previous.current = pathname;
  }, [pathname, search]);
}
