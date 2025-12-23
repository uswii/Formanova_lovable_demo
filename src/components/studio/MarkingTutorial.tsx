import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Props {
  onDismiss: () => void;
}

// Preload video globally so it's cached
const videoUrl = '/videos/marking-tutorial.mp4';
if (typeof window !== 'undefined') {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'video';
  link.href = videoUrl;
  document.head.appendChild(link);
}

export function MarkingTutorial({ onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 bg-background border border-border p-6">
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

        {/* Video demo */}
        <div className="relative aspect-video bg-muted/30 border border-border/50 mb-4 overflow-hidden rounded-sm">
          <video
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="w-full h-full object-contain"
          />
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
