import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export function CinematicCursor() {
  const { theme } = useTheme();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [scrollPulse, setScrollPulse] = useState(0);
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  
  // Track scroll for pulse effect
  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const delta = Math.abs(window.scrollY - lastScrollY);
      setScrollPulse(Math.min(delta / 50, 1));
      lastScrollY = window.scrollY;
      
      // Decay the pulse
      setTimeout(() => setScrollPulse(0), 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setIsVisible(true);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    // Check for hoverable elements
    const handleElementHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.closest('button, a, [role="button"], input, textarea, select, .cursor-pointer');
      setIsHovering(!!isInteractive);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseover', handleElementHover);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseover', handleElementHover);
    };
  }, []);

  // Theme-specific cursor styles
  const getCursorStyle = () => {
    const baseSize = isHovering ? 48 : 16 + scrollPulse * 24;
    const scale = 1 + scrollPulse * 0.5;
    
    const styles: Record<string, React.CSSProperties> = {
      light: {
        background: 'hsl(0 0% 0% / 0.9)',
        boxShadow: 'none',
      },
      dark: {
        background: 'hsl(0 0% 100% / 0.9)',
        boxShadow: '0 0 20px hsl(0 0% 100% / 0.3)',
      },
      neon: {
        background: 'hsl(195 100% 50% / 0.8)',
        boxShadow: `0 0 ${20 + scrollPulse * 30}px hsl(195 100% 50% / 0.6), 0 0 ${40 + scrollPulse * 40}px hsl(195 100% 50% / 0.4)`,
      },
      cyberpunk: {
        background: 'hsl(320 100% 60% / 0.8)',
        boxShadow: `0 0 ${20 + scrollPulse * 30}px hsl(320 100% 60% / 0.6)`,
      },
      synthwave: {
        background: 'linear-gradient(135deg, hsl(320 100% 62%), hsl(180 100% 48%))',
        boxShadow: `0 0 ${20 + scrollPulse * 30}px hsl(320 100% 62% / 0.5)`,
      },
      retro: {
        background: 'hsl(120 100% 50%)',
        boxShadow: `0 0 ${10 + scrollPulse * 20}px hsl(120 100% 50% / 0.5)`,
        borderRadius: '0',
      },
      kawaii: {
        background: 'hsl(340 85% 65%)',
        boxShadow: `0 0 ${15 + scrollPulse * 20}px hsl(340 85% 65% / 0.4)`,
      },
      cutie: {
        background: 'hsl(300 70% 68%)',
        boxShadow: `0 0 ${15 + scrollPulse * 20}px hsl(300 70% 68% / 0.4)`,
      },
      luxury: {
        background: 'linear-gradient(135deg, hsl(15 60% 58%), hsl(42 85% 55%))',
        boxShadow: `0 0 ${20 + scrollPulse * 20}px hsl(42 85% 55% / 0.3)`,
      },
      fashion: {
        background: 'hsl(42 85% 55%)',
        boxShadow: `0 0 ${15 + scrollPulse * 20}px hsl(42 85% 55% / 0.4)`,
      },
      vintage: {
        background: 'hsl(15 70% 38%)',
        boxShadow: 'none',
      },
      nostalgia: {
        background: 'hsl(25 60% 45%)',
        boxShadow: 'none',
      },
    };

    return {
      width: baseSize,
      height: baseSize,
      transform: `translate(-50%, -50%) scale(${scale})`,
      ...styles[theme] || styles.dark,
    };
  };

  const getTrailStyle = () => {
    const size = 40 + scrollPulse * 20;
    
    return {
      width: size,
      height: size,
      opacity: 0.2 + scrollPulse * 0.3,
      transform: 'translate(-50%, -50%)',
    };
  };

  // Hide on touch devices
  if (typeof window !== 'undefined' && 'ontouchstart' in window) {
    return null;
  }

  return (
    <>
      {/* Trail effect */}
      <div
        ref={trailRef}
        className="fixed pointer-events-none z-[9998] rounded-full transition-all duration-300 ease-out mix-blend-difference"
        style={{
          left: position.x,
          top: position.y,
          opacity: isVisible ? 0.15 : 0,
          background: 'hsl(var(--foreground))',
          ...getTrailStyle(),
        }}
      />
      
      {/* Main cursor */}
      <div
        ref={cursorRef}
        className="fixed pointer-events-none z-[9999] rounded-full transition-all duration-150 ease-out"
        style={{
          left: position.x,
          top: position.y,
          opacity: isVisible ? 1 : 0,
          ...getCursorStyle(),
        }}
      />
      
      {/* Hide default cursor globally */}
      <style>{`
        @media (pointer: fine) {
          * {
            cursor: none !important;
          }
        }
      `}</style>
    </>
  );
}
