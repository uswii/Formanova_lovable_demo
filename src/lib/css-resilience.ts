/**
 * CSS Resilience Monitor
 * Detects failed stylesheet loads and retries them once.
 * Safe for production — no-op if all styles load normally.
 */

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

function retryStylesheet(link: HTMLLinkElement, attempt = 1) {
  if (attempt > MAX_RETRIES) {
    console.warn(`[css-resilience] Failed to load stylesheet after ${MAX_RETRIES} retries:`, link.href);
    return;
  }

  const clone = document.createElement('link');
  clone.rel = 'stylesheet';
  clone.href = link.href + (link.href.includes('?') ? '&' : '?') + `_retry=${attempt}`;
  clone.crossOrigin = link.crossOrigin || '';

  clone.onerror = () => {
    setTimeout(() => retryStylesheet(link, attempt + 1), RETRY_DELAY_MS);
  };

  clone.onload = () => {
    console.info('[css-resilience] Successfully loaded stylesheet on retry:', link.href);
  };

  document.head.appendChild(clone);
}

export function initCssResilience() {
  // Monitor existing link[rel=stylesheet] elements
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
  links.forEach((link) => {
    // If already failed (sheet is null and not loading), retry
    if (link.sheet === null && link.href) {
      link.addEventListener('error', () => retryStylesheet(link), { once: true });
    }
  });

  // Watch for dynamically inserted stylesheets (Vite injects CSS at runtime)
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
          node.addEventListener('error', () => retryStylesheet(node), { once: true });
        }
      });
    }
  });

  observer.observe(document.head, { childList: true });

  // Return cleanup function
  return () => observer.disconnect();
}
