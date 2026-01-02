import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import mannequinJewelry from '@/assets/tutorial/mannequin-jewelry.jpg';

interface Props {
  onDismiss: () => void;
}

// Dot positions based on the jewelry mask (normalized 0-1 coordinates)
// These positions correspond to key points on the necklace
const DOT_POSITIONS = [
  { x: 0.35, y: 0.52, delay: 0 },    // Left side of necklace
  { x: 0.50, y: 0.62, delay: 800 },  // Center pendant
  { x: 0.65, y: 0.52, delay: 1600 }, // Right side of necklace
];

export function MarkingTutorial({ onDismiss }: Props) {
  const [visibleDots, setVisibleDots] = useState<number>(0);
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
        return { 
          fill: 'rgb(255, 0, 180)', 
          stroke: 'rgba(255, 0, 180, 0.5)',
          glow: '0 0 20px rgba(255, 0, 180, 0.8), 0 0 40px rgba(255, 0, 180, 0.4)'
        };
      case 'vintage':
        return { 
          fill: 'rgb(180, 90, 60)', 
          stroke: 'rgba(180, 90, 60, 0.5)',
          glow: '0 0 15px rgba(180, 90, 60, 0.6)'
        };
      case 'nature':
        return { 
          fill: 'rgb(80, 180, 100)', 
          stroke: 'rgba(80, 180, 100, 0.5)',
          glow: '0 0 15px rgba(80, 180, 100, 0.6)'
        };
      case 'ocean':
        return { 
          fill: 'rgb(0, 180, 200)', 
          stroke: 'rgba(0, 180, 200, 0.5)',
          glow: '0 0 15px rgba(0, 180, 200, 0.6)'
        };
      case 'kawaii':
        return { 
          fill: 'rgb(240, 120, 160)', 
          stroke: 'rgba(240, 120, 160, 0.5)',
          glow: '0 0 15px rgba(240, 120, 160, 0.6)'
        };
      case 'fashion':
        return { 
          fill: 'rgb(220, 180, 80)', 
          stroke: 'rgba(220, 180, 80, 0.5)',
          glow: '0 0 20px rgba(220, 180, 80, 0.7)'
        };
      case 'luxury':
        return { 
          fill: 'rgb(200, 160, 140)', 
          stroke: 'rgba(200, 160, 140, 0.5)',
          glow: '0 0 15px rgba(200, 160, 140, 0.6)'
        };
      case 'dark':
      default:
        return { 
          fill: 'rgb(255, 80, 80)', 
          stroke: 'rgba(255, 80, 80, 0.5)',
          glow: '0 0 15px rgba(255, 80, 80, 0.6)'
        };
    }
  }, [currentTheme]);

  // Animate dots appearing one by one, then reset
  useEffect(() => {
    setVisibleDots(0);
    
    const timers: NodeJS.Timeout[] = [];
    
    // Show dots one by one
    DOT_POSITIONS.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleDots(index + 1);
      }, DOT_POSITIONS[index].delay);
      timers.push(timer);
    });

    // After all dots shown, wait 2s then restart
    const resetTimer = setTimeout(() => {
      setCycleKey(k => k + 1);
    }, DOT_POSITIONS[DOT_POSITIONS.length - 1].delay + 2500);
    timers.push(resetTimer);

    return () => timers.forEach(t => clearTimeout(t));
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
        <div className="relative aspect-[3/4] bg-muted/30 border border-border/50 mb-4 overflow-hidden rounded-lg">
          <img
            src={mannequinJewelry}
            alt="Mannequin with jewelry"
            className="w-full h-full object-contain"
          />
          
          {/* Animated dots */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {DOT_POSITIONS.slice(0, visibleDots).map((dot, index) => (
              <g key={`${cycleKey}-${index}`}>
                {/* Outer pulse ring */}
                <circle
                  cx={`${dot.x * 100}%`}
                  cy={`${dot.y * 100}%`}
                  r="20"
                  fill="none"
                  stroke={dotStyle.stroke}
                  strokeWidth="2"
                  className="animate-ping"
                  style={{ 
                    animationDuration: '1.5s',
                    transformOrigin: `${dot.x * 100}% ${dot.y * 100}%`
                  }}
                />
                {/* Main dot */}
                <circle
                  cx={`${dot.x * 100}%`}
                  cy={`${dot.y * 100}%`}
                  r="8"
                  fill={dotStyle.fill}
                  stroke="white"
                  strokeWidth="2"
                  style={{ 
                    filter: `drop-shadow(${dotStyle.glow})`,
                    animation: 'scale-in 0.3s ease-out'
                  }}
                />
                {/* Dot number */}
                <text
                  x={`${dot.x * 100}%`}
                  y={`${dot.y * 100}%`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                >
                  {index + 1}
                </text>
              </g>
            ))}
          </svg>

          {/* Progress indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {DOT_POSITIONS.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index < visibleDots 
                    ? 'bg-primary scale-100' 
                    : 'bg-muted-foreground/30 scale-75'
                }`}
              />
            ))}
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