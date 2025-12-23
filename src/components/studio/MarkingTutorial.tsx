import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Props {
  onDismiss: () => void;
}

export function MarkingTutorial({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  
  // Auto-animate through steps
  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev + 1) % 4);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Dot positions simulating marking a necklace
  const dots = [
    { x: 35, y: 45, delay: 0 },
    { x: 50, y: 42, delay: 1 },
    { x: 65, y: 45, delay: 2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-background border border-border p-6">
        {/* Close button */}
        <button 
          onClick={onDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-6">
          <span className="marta-label mb-2 block">How It Works</span>
          <h3 className="font-display text-2xl uppercase">Mark Your Jewelry</h3>
        </div>

        {/* Animated demo area */}
        <div className="relative aspect-[4/3] bg-muted/30 border border-border/50 mb-6 overflow-hidden">
          {/* Simulated necklace shape */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
            {/* Simple necklace curve */}
            <path
              d="M 20 35 Q 50 55 80 35"
              fill="none"
              stroke="hsl(var(--foreground) / 0.3)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Pendant */}
            <circle cx="50" cy="52" r="4" fill="hsl(var(--foreground) / 0.3)" />
          </svg>

          {/* Animated cursor */}
          <div 
            className="absolute w-6 h-6 transition-all duration-500 ease-out"
            style={{
              left: `${dots[Math.min(step, 2)]?.x ?? 50}%`,
              top: `${dots[Math.min(step, 2)]?.y ?? 45}%`,
              transform: 'translate(-50%, -50%)',
              opacity: step < 3 ? 1 : 0,
            }}
          >
            {/* Cursor icon */}
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full drop-shadow-lg">
              <path 
                d="M5 3L19 12L12 13L9 20L5 3Z" 
                fill="white" 
                stroke="black" 
                strokeWidth="1.5"
              />
            </svg>
          </div>

          {/* Red dots appearing */}
          {dots.map((dot, i) => (
            <div
              key={i}
              className="absolute transition-all duration-300"
              style={{
                left: `${dot.x}%`,
                top: `${dot.y}%`,
                transform: 'translate(-50%, -50%)',
                opacity: step > dot.delay ? 1 : 0,
                scale: step > dot.delay ? '1' : '0',
              }}
            >
              <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg" />
            </div>
          ))}

          {/* Click ripple effect */}
          {step < 3 && (
            <div 
              className="absolute pointer-events-none"
              style={{
                left: `${dots[step]?.x ?? 50}%`,
                top: `${dots[step]?.y ?? 45}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="w-8 h-8 rounded-full border-2 border-red-400 animate-ping" />
            </div>
          )}

          {/* Step indicator */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {[0, 1, 2, 3].map(i => (
              <div 
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  step === i ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-red-400">1</span>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Tap on the necklace</strong> to place red markers
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-red-400">2</span>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Place 3-5 dots</strong> along the jewelry chain
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-red-400">3</span>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">AI detects the rest</strong> — no need to mark everything
            </p>
          </div>
        </div>

        <Button onClick={onDismiss} className="w-full">
          Got it, let me try
        </Button>
      </div>
    </div>
  );
}
