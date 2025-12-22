import { useEffect, useState, useCallback } from 'react';

interface ParallaxValues {
  y: number;
  opacity: number;
  scale: number;
}

interface UseParallaxOptions {
  speed?: number; // 0.1 to 1, lower = slower parallax
  maxOffset?: number; // Maximum offset in pixels
  fadeOut?: boolean; // Whether to fade as scrolling
  scaleEffect?: boolean; // Whether to scale slightly
}

export function useParallax(options: UseParallaxOptions = {}): ParallaxValues {
  const { 
    speed = 0.3, 
    maxOffset = 200,
    fadeOut = true,
    scaleEffect = false
  } = options;
  
  const [values, setValues] = useState<ParallaxValues>({ 
    y: 0, 
    opacity: 1,
    scale: 1
  });

  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    
    // Calculate parallax offset
    const y = Math.min(scrollY * speed, maxOffset);
    
    // Calculate opacity (fade out as scrolling down)
    const opacity = fadeOut 
      ? Math.max(1 - (scrollY / windowHeight) * 0.8, 0.2)
      : 1;
    
    // Calculate scale (subtle zoom out effect)
    const scale = scaleEffect 
      ? Math.max(1 - (scrollY / windowHeight) * 0.1, 0.9)
      : 1;
    
    setValues({ y, opacity, scale });
  }, [speed, maxOffset, fadeOut, scaleEffect]);

  useEffect(() => {
    // Initial calculation
    handleScroll();
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return values;
}

// Hook for elements that should move in opposite direction (foreground effect)
export function useParallaxForeground(speed: number = 0.15) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setOffset(-window.scrollY * speed);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return offset;
}
