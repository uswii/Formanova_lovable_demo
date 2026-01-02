import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import mannequinJewelry from '@/assets/tutorial/mannequin-jewelry.jpg';

interface Props {
  onDismiss: () => void;
}

// Dot positions exactly on the jewelry (normalized 0-1 coordinates based on mask)
// Left chain, center pendant, right chain
const DOT_POSITIONS = [
  { x: 0.38, y: 0.44 },  // Left side of necklace chain
  { x: 0.50, y: 0.58 },  // Center pendant (blue gem)
  { x: 0.62, y: 0.44 },  // Right side of necklace chain
];

export function MarkingTutorial({ onDismiss }: Props) {
  const [currentDotIndex, setCurrentDotIndex] = useState(-1); // -1 = cursor moving, 0+ = dot placed
  const [cursorPos, setCursorPos] = useState({ x: 0.2, y: 0.3 });
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
        return { fill: 'rgb(255, 0, 180)', glow: '0 0 12px rgba(255, 0, 180, 0.8)' };
      case 'vintage':
        return { fill: 'rgb(180, 90, 60)', glow: '0 0 10px rgba(180, 90, 60, 0.6)' };
      case 'nature':
        return { fill: 'rgb(80, 180, 100)', glow: '0 0 10px rgba(80, 180, 100, 0.6)' };
      case 'ocean':
        return { fill: 'rgb(0, 180, 200)', glow: '0 0 10px rgba(0, 180, 200, 0.6)' };
      case 'kawaii':
        return { fill: 'rgb(240, 120, 160)', glow: '0 0 10px rgba(240, 120, 160, 0.6)' };
      case 'fashion':
        return { fill: 'rgb(220, 180, 80)', glow: '0 0 12px rgba(220, 180, 80, 0.7)' };
      case 'luxury':
        return { fill: 'rgb(200, 160, 140)', glow: '0 0 10px rgba(200, 160, 140, 0.6)' };
      case 'dark':
      default:
        return { fill: 'rgb(255, 80, 80)', glow: '0 0 10px rgba(255, 80, 80, 0.6)' };
    }
  }, [currentTheme]);

  // Animation: move cursor to each dot position, then place dot
  useEffect(() => {
    setCurrentDotIndex(-1);
    setPlacedDots([]);
    setCursorPos({ x: 0.2, y: 0.3 });
    
    let dotIndex = 0;
    let phase: 'moving' | 'placing' = 'moving';
    
    const animate = () => {
      if (dotIndex >= DOT_POSITIONS.length) {
        // All dots placed, wait then restart
        setTimeout(() => setCycleKey(k => k + 1), 2000);
        return;
      }
      
      const targetDot = DOT_POSITIONS[dotIndex];
      
      if (phase === 'moving') {
        // Animate cursor moving to target
        const startPos = dotIndex === 0 ? { x: 0.2, y: 0.3 } : DOT_POSITIONS[dotIndex - 1];
        const duration = 600;
        const startTime = Date.now();
        
        const moveCursor = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          
          setCursorPos({
            x: startPos.x + (targetDot.x - startPos.x) * eased,
            y: startPos.y + (targetDot.y - startPos.y) * eased,
          });
          
          if (progress < 1) {
            requestAnimationFrame(moveCursor);
          } else {
            // Cursor arrived, now place dot
            phase = 'placing';
            setTimeout(animate, 150);
          }
        };
        
        requestAnimationFrame(moveCursor);
      } else {
        // Place the dot
        setPlacedDots(prev => [...prev, dotIndex]);
        dotIndex++;
        phase = 'moving';
        setTimeout(animate, 400);
      }
    };
    
    // Start animation after a short delay
    const timer = setTimeout(animate, 500);
    
    return () => clearTimeout(timer);
  }, [cycleKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 bg-background border border-border p-6 rounded-lg">
        {/* Close button */}
        <button 
          onClick={onDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-4">
          <span className="marta-label mb-2 block">How It Works</span>
          <h3 className="font-display text-2xl uppercase">Mark Your Jewelry</h3>
        </div>

        {/* Animated demo */}
        <div className="relative aspect-[3/4] bg-muted/30 border border-border/50 mb-4 overflow-hidden rounded-lg cursor-none">
          <img
            src={mannequinJewelry}
            alt="Mannequin with jewelry"
            className="w-full h-full object-contain"
          />
          
          {/* Placed dots */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {placedDots.map((dotIdx) => {
              const dot = DOT_POSITIONS[dotIdx];
              return (
                <circle
                  key={`${cycleKey}-${dotIdx}`}
                  cx={`${dot.x * 100}%`}
                  cy={`${dot.y * 100}%`}
                  r="7"
                  fill={dotStyle.fill}
                  stroke="white"
                  strokeWidth="2"
                  style={{ filter: `drop-shadow(${dotStyle.glow})` }}
                />
              );
            })}
          </svg>

          {/* Animated cursor */}
          <div 
            className="absolute pointer-events-none transition-none"
            style={{
              left: `${cursorPos.x * 100}%`,
              top: `${cursorPos.y * 100}%`,
              transform: 'translate(-2px, -2px)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
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
        <p className="text-sm text-muted-foreground text-center mb-4">
          Place <strong className="text-foreground">3-5 dots</strong> on the jewelry and click generate. That's it!
        </p>

        <Button onClick={onDismiss} className="w-full">
          Got it, let me try
        </Button>
      </div>
    </div>
  );
}