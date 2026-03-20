import {
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from '@/lib/auth-api';

export const POST_RELOAD_REDIRECT_KEY = 'post_reload_redirect';
export const POST_RELOAD_MESSAGE_KEY = 'post_reload_message';

export function getCurrentPathWithState(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function persistAuthSnapshot(): void {
  const token = getStoredToken();
  const user = getStoredUser();

  if (token) setStoredToken(token);
  if (user) setStoredUser(user);
}

interface ReloadOptions {
  redirectTo?: string;
  message?: string;
}

/**
 * Reload the app while preserving auth/session + return location.
 */
export function reloadPreservingSession(options: ReloadOptions = {}): void {
  const redirectTo = options.redirectTo ?? getCurrentPathWithState();

  persistAuthSnapshot();
  sessionStorage.setItem(POST_RELOAD_REDIRECT_KEY, redirectTo);

  if (options.message) {
    sessionStorage.setItem(POST_RELOAD_MESSAGE_KEY, options.message);
  } else {
    sessionStorage.removeItem(POST_RELOAD_MESSAGE_KEY);
  }

  window.location.reload();
}
