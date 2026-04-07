import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/posthog-events';

/**
 * Captures a PostHog $pageview on every React Router route change.
 * Must be rendered inside <BrowserRouter>.
 */
export function PostHogPageView() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(window.location.href);
  }, [location.pathname, location.search]);

  return null;
}
