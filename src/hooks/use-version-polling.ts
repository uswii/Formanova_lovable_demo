import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Polls /version.json and surfaces a non-intrusive update banner
 * when the app version changes after deployment.
 *
 * Generation-aware: defers the banner while a generation is in progress
 * and shows it once the generation completes.
 */
export function useVersionPolling() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialVersion = useRef<string | null>(null);
  const location = useLocation();

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const version = data?.version;
      if (!version) return;

      if (initialVersion.current === null) {
        initialVersion.current = version;
        return;
      }

      if (version !== initialVersion.current) {
        // If generation in progress, defer — the flag listener below will catch it
        if ((window as any).__generationInProgress) return;
        setUpdateAvailable(true);
      }
    } catch {
      // Network error — silently ignore
    }
  }, []);

  // Poll on interval
  useEffect(() => {
    checkVersion(); // initial fetch to capture baseline
    const id = setInterval(checkVersion, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkVersion]);

  // Also check on route change
  useEffect(() => {
    checkVersion();
  }, [location.pathname, checkVersion]);

  // Listen for generation completion to surface deferred update
  useEffect(() => {
    const handler = () => {
      if (initialVersion.current) {
        checkVersion();
      }
    };
    window.addEventListener('generation:complete', handler);
    return () => window.removeEventListener('generation:complete', handler);
  }, [checkVersion]);

  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  const dismiss = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return { updateAvailable, refresh, dismiss };
}
