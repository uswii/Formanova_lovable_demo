import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import mannequinNecklace from '@/assets/tutorial/mannequin-necklace-studio.jpg';

interface Props {
  onDismiss: () => void;
}

// Dot positions exactly on the necklace (normalized 0-1 coordinates)
// Based on the generated image: diamond chain with sapphire pendant
const DOT_POSITIONS = [
  { x: 0.30, y: 0.32 },  // Left necklace chain 
  { x: 0.50, y: 0.48 },  // Center pendant (sapphire)
  { x: 0.70, y: 0.32 },  // Right necklace chain
];

export function MarkingTutorial({ onDismiss }: Props) {
  const [cursorPos, setCursorPos] = useState({ x: 0.15, y: 0.15 });
  const [placedDots, setPlacedDots] = useState<number[]>([]);
  const [cycleKey, setCycleKey] = useState(0);

  // Get current theme
  const [currentTheme, setCurrentTheme] = useState(() => 
    document.documentElement.getAttribute('data-theme') || 
    (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  );

  // Listen for theme changes
  useEffect(() => {
    const updateTheme = () => {
      setCurrentTheme(
        document.documentElement.getAttribute('data-theme') || 
        (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
      );
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => observer.disconnect();
  }, []);

  // Theme-aware dot colors
  const dotStyle = useMemo(() => {
    switch (currentTheme) {
      case 'cyberpunk':
        return { fill: 'rgb(255, 0, 180)', glow: '0 0 8px rgba(255, 0, 180, 0.8)' };
      case 'vintage':
        return { fill: 'rgb(180, 90, 60)', glow: '0 0 6px rgba(180, 90, 60, 0.6)' };
      case 'nature':
        return { fill: 'rgb(80, 180, 100)', glow: '0 0 6px rgba(80, 180, 100, 0.6)' };
      case 'ocean':
        return { fill: 'rgb(0, 180, 200)', glow: '0 0 6px rgba(0, 180, 200, 0.6)' };
      case 'kawaii':
        return { fill: 'rgb(240, 120, 160)', glow: '0 0 6px rgba(240, 120, 160, 0.6)' };
      case 'fashion':
        return { fill: 'rgb(220, 180, 80)', glow: '0 0 8px rgba(220, 180, 80, 0.7)' };
      case 'luxury':
        return { fill: 'rgb(200, 160, 140)', glow: '0 0 6px rgba(200, 160, 140, 0.6)' };
      case 'dark':
      default:
        return { fill: 'rgb(255, 80, 80)', glow: '0 0 6px rgba(255, 80, 80, 0.6)' };
    }
  }, [currentTheme]);

  // Animation: move cursor to each dot position, then place dot
  useEffect(() => {
    setPlacedDots([]);
    setCursorPos({ x: 0.15, y: 0.15 });
    
    let dotIndex = 0;
    let phase: 'moving' | 'placing' = 'moving';
    let animationId: number;
    
    const animate = () => {
      if (dotIndex >= DOT_POSITIONS.length) {
        // All dots placed, wait then restart
        setTimeout(() => setCycleKey(k => k + 1), 1500);
        return;
      }
      
      const targetDot = DOT_POSITIONS[dotIndex];
      
      if (phase === 'moving') {
        const startPos = dotIndex === 0 ? { x: 0.15, y: 0.15 } : DOT_POSITIONS[dotIndex - 1];
        const duration = 500;
        const startTime = Date.now();
        
        const moveCursor = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          
          setCursorPos({
            x: startPos.x + (targetDot.x - startPos.x) * eased,
            y: startPos.y + (targetDot.y - startPos.y) * eased,
          });
          
          if (progress < 1) {
            animationId = requestAnimationFrame(moveCursor);
          } else {
            phase = 'placing';
            setTimeout(animate, 100);
          }
        };
        
        animationId = requestAnimationFrame(moveCursor);
      } else {
        setPlacedDots(prev => [...prev, dotIndex]);
        dotIndex++;
        phase = 'moving';
        setTimeout(animate, 300);
      }
    };
    
    const timer = setTimeout(animate, 400);
    
    return () => {
      clearTimeout(timer);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [cycleKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xs mx-4 bg-background border border-border p-4 rounded-lg">
        {/* Close button */}
        <button 
          onClick={onDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center mb-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">How It Works</span>
          <h3 className="font-display text-lg uppercase">Mark Jewelry</h3>
        </div>

        {/* Animated demo - compact */}
        <div className="relative aspect-[3/4] bg-muted/30 border border-border/50 mb-3 overflow-hidden rounded">
          <img
            src={mannequinNecklace}
            alt="Mannequin with necklace"
            className="w-full h-full object-cover"
          />
          
          {/* Placed dots */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {placedDots.map((dotIdx) => {
              const dot = DOT_POSITIONS[dotIdx];
              if (!dot) return null;
              return (
                <circle
                  key={`${cycleKey}-${dotIdx}`}
                  cx={`${dot.x * 100}%`}
                  cy={`${dot.y * 100}%`}
                  r="5"
                  fill={dotStyle.fill}
                  stroke="white"
                  strokeWidth="1.5"
                  style={{ filter: `drop-shadow(${dotStyle.glow})` }}
                />
              );
            })}
          </svg>

          {/* Animated cursor */}
          <div 
            className="absolute pointer-events-none"
            style={{
              left: `${cursorPos.x * 100}%`,
              top: `${cursorPos.y * 100}%`,
              transform: 'translate(-2px, -2px)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path 
                d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z" 
                fill="white" 
                stroke="black" 
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </div>

        {/* Brief instruction */}
        <p className="text-xs text-muted-foreground text-center mb-3">
          Click <strong className="text-foreground">3-5 dots</strong> on the jewelry
        </p>

        <Button onClick={onDismiss} size="sm" className="w-full">
          Got it
        </Button>
      </div>
    </div>
  );
}