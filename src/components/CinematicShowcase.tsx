import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import images
import mannequinInput from '@/assets/showcase/mannequin-input.png';
import jewelryMask from '@/assets/showcase/jewelry-mask.png';
import modelBlackDress from '@/assets/showcase/model-black-dress.png';
import modelWhiteDress from '@/assets/showcase/model-white-dress.png';
import modelBlackTank from '@/assets/showcase/model-black-tank.png';

const generatedImages = [modelBlackDress, modelWhiteDress, modelBlackTank];

// Metrics per output
const metricsPerOutput = [
  { precision: 99.2, recall: 98.7, iou: 97.4 },
  { precision: 98.9, recall: 99.1, iou: 96.8 },
  { precision: 99.5, recall: 98.4, iou: 97.9 },
];

export function CinematicShowcase() {
  const [showInput, setShowInput] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finalIndex, setFinalIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overlayDataUrl, setOverlayDataUrl] = useState<string>('');

  // Create themed overlay from mask - improved for all themes
  useEffect(() => {
    const generateOverlay = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const maskImg = new Image();
      const baseImg = new Image();

      let loaded = 0;
      const onLoad = () => {
        loaded++;
        if (loaded < 2) return;

        canvas.width = baseImg.naturalWidth;
        canvas.height = baseImg.naturalHeight;
        ctx.drawImage(baseImg, 0, 0);

        // Get theme info
        const theme = document.documentElement.getAttribute('data-theme') || 
                      (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        
        // Use contrasting colors per theme
        let overlayColor: string;
        let glowColor: string;
        
        switch(theme) {
          case 'dark':
            overlayColor = 'rgba(255, 255, 255, 0.25)';
            glowColor = 'rgba(255, 255, 255, 0.4)';
            break;
          case 'cyberpunk':
            overlayColor = 'rgba(255, 0, 200, 0.3)';
            glowColor = 'rgba(0, 255, 255, 0.5)';
            break;
          case 'vintage':
            overlayColor = 'rgba(180, 140, 80, 0.35)';
            glowColor = 'rgba(220, 180, 100, 0.5)';
            break;
          case 'nature':
            overlayColor = 'rgba(100, 180, 100, 0.3)';
            glowColor = 'rgba(150, 220, 150, 0.5)';
            break;
          case 'ocean':
            overlayColor = 'rgba(0, 150, 200, 0.3)';
            glowColor = 'rgba(100, 200, 255, 0.5)';
            break;
          default: // light
            overlayColor = 'rgba(0, 0, 0, 0.2)';
            glowColor = 'rgba(0, 0, 0, 0.35)';
        }

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) return;

        maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
        const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);

        // First pass: draw glow (slightly expanded)
        ctx.save();
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = maskData.data[idx];
            const g = maskData.data[idx + 1];
            const b = maskData.data[idx + 2];
            
            if (r > 180 && g > 180 && b > 180) {
              ctx.fillStyle = glowColor;
              ctx.fillRect(x - 1, y - 1, 3, 3);
            }
          }
        }
        ctx.restore();

        // Second pass: main overlay
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = maskData.data[idx];
            const g = maskData.data[idx + 1];
            const b = maskData.data[idx + 2];
            
            if (r > 200 && g > 200 && b > 200) {
              ctx.fillStyle = overlayColor;
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }

        setOverlayDataUrl(canvas.toDataURL('image/png'));
      };

      maskImg.onload = onLoad;
      baseImg.onload = onLoad;
      maskImg.src = jewelryMask;
      baseImg.src = mannequinInput;
    };

    generateOverlay();

    const observer = new MutationObserver(generateOverlay);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['data-theme', 'class'] 
    });

    return () => observer.disconnect();
  }, []);

  // Section A: Toggle between input and outputs (synced with metrics)
  useEffect(() => {
    const interval = setInterval(() => {
      setShowInput(prev => {
        if (prev) {
          return false;
        } else {
          setCurrentIndex(i => (i + 1) % generatedImages.length);
          return true;
        }
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Section C: Final images cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setFinalIndex(prev => (prev + 1) % generatedImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentMetrics = metricsPerOutput[currentIndex];

  return (
    <div className="w-full">
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
        
        {/* SECTION A — Toggle Effect */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border">
          <AnimatePresence mode="sync">
            <motion.img
              key={showInput ? 'input' : `output-${currentIndex}`}
              src={showInput ? (overlayDataUrl || mannequinInput) : generatedImages[currentIndex]}
              alt={showInput ? "Input" : "Output"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 w-full h-full object-contain"
            />
          </AnimatePresence>
          
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className={`px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider transition-colors duration-150 ${
              showInput 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-background/90 text-foreground border border-border'
            }`}>
              {showInput ? 'Input' : 'Output'}
            </div>
          </div>
        </div>

        {/* SECTION B — Metrics Display (synced with current output) */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border flex flex-col items-center justify-center p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-8 text-center"
            >
              {/* Main metric - large */}
              <div>
                <div className="text-5xl md:text-6xl font-mono font-bold text-foreground">
                  {currentMetrics.precision.toFixed(1)}
                  <span className="text-2xl text-muted-foreground">%</span>
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest mt-2">
                  Precision
                </div>
              </div>

              {/* Secondary metrics */}
              <div className="flex gap-8 justify-center">
                <div>
                  <div className="text-2xl font-mono font-semibold text-foreground">
                    {currentMetrics.recall.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Recall
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-mono font-semibold text-foreground">
                    {currentMetrics.iou.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    IoU
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          
          {/* Jewelry preserved message */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
                Jewelry Unchanged
              </span>
            </div>
          </div>

          {/* Output indicator dots */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {generatedImages.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentIndex === i ? 'bg-primary w-4' : 'bg-foreground/15 w-1.5'
                }`}
              />
            ))}
          </div>
        </div>

        {/* SECTION C — Final Clean Output */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border">
          <AnimatePresence mode="wait">
            <motion.img
              key={finalIndex}
              src={generatedImages[finalIndex]}
              alt="Final result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full h-full object-contain"
            />
          </AnimatePresence>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {generatedImages.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  finalIndex === i ? 'bg-primary w-4' : 'bg-foreground/20 w-1.5'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
