import React, { forwardRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** true = eager load + high fetchpriority (for LCP / above-the-fold) */
  priority?: boolean;
  /** CSS aspect-ratio value e.g. "3/4", "16/9" to prevent CLS */
  aspectRatio?: string;
  /** Disable the fade-in transition (e.g. for dynamically-generated data URLs) */
  noFade?: boolean;
}

/**
 * Drop-in `<img>` replacement that enforces performance best practices:
 * - `loading="lazy"` by default (overridable with `priority`)
 * - `decoding="async"` by default
 * - `fetchpriority="high"` when `priority` is set
 * - CSS `aspect-ratio` to prevent CLS
 * - Smooth 200ms fade-in on load to eliminate pop-in
 * - `bg-muted` placeholder while loading
 */
const OptimizedImage = forwardRef<HTMLImageElement, OptimizedImageProps>(
  ({ priority = false, aspectRatio, noFade = false, className, style, onLoad, ...props }, ref) => {
    // Priority images start visible (no fade needed)
    const [loaded, setLoaded] = useState(priority || noFade);

    const handleLoad = useCallback(
      (e: React.SyntheticEvent<HTMLImageElement>) => {
        setLoaded(true);
        onLoad?.(e);
      },
      [onLoad],
    );

    return (
      <img
        ref={ref}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        {...(priority ? { fetchPriority: 'high' as const } : {})}
        onLoad={handleLoad}
        className={cn('bg-muted', className)}
        style={{
          opacity: loaded ? 1 : 0,
          transition: loaded ? 'opacity 0.2s ease-in' : undefined,
          ...(aspectRatio ? { aspectRatio } : {}),
          ...style,
        }}
        {...props}
      />
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';

/** Preload images into the browser cache so they appear instantly when needed. */
export function preloadImages(srcs: string[]) {
  srcs.forEach((src) => {
    const img = new window.Image();
    img.src = src;
  });
}

export { OptimizedImage };
export type { OptimizedImageProps };
