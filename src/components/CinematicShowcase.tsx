import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import images
import mannequinInput from '@/assets/showcase/mannequin-input.png';
import jewelryMask from '@/assets/showcase/jewelry-mask.png';
import modelBlackDress from '@/assets/showcase/model-black-dress.png';
import modelWhiteDress from '@/assets/showcase/model-white-dress.png';
import modelBlackTank from '@/assets/showcase/model-black-tank.png';

const generatedImages = [modelBlackDress, modelWhiteDress, modelBlackTank];

const metrics = [
  { label: 'Precision', value: 99.2, suffix: '%' },
  { label: 'Recall', value: 98.7, suffix: '%' },
  { label: 'IoU', value: 97.4, suffix: '%' },
];

export function CinematicShowcase() {
  const [showInput, setShowInput] = useState(true);
  const [outputIndex, setOutputIndex] = useState(0);
  const [finalIndex, setFinalIndex] = useState(0);
  const [animatedMetrics, setAnimatedMetrics] = useState([0, 0, 0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overlayDataUrl, setOverlayDataUrl] = useState<string>('');

  // Create themed overlay from mask
  useEffect(() => {
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

      const computedStyle = getComputedStyle(document.documentElement);
      const primaryHsl = computedStyle.getPropertyValue('--primary').trim();
      const [h, s, l] = primaryHsl.split(' ').map(v => parseFloat(v));
      const overlayColor = `hsla(${h}, ${s}%, ${l}%, 0.35)`;

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) return;

      maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
      const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);

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

    const observer = new MutationObserver(() => {
      loaded = 0;
      maskImg.src = jewelryMask;
      baseImg.src = mannequinInput;
    });
    
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['data-theme', 'class'] 
    });

    return () => observer.disconnect();
  }, []);

  // Section A: Clean toggle between input and outputs
  useEffect(() => {
    const interval = setInterval(() => {
      setShowInput(prev => {
        if (prev) {
          // Was showing input, now show output
          return false;
        } else {
          // Was showing output, cycle to next output then show input
          setOutputIndex(i => (i + 1) % generatedImages.length);
          return true;
        }
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Section C: Final images cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setFinalIndex(prev => (prev + 1) % generatedImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Animate metrics on mount
  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const stepTime = duration / steps;
    
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      
      setAnimatedMetrics(metrics.map(m => m.value * eased));
      
      if (step >= steps) clearInterval(interval);
    }, stepTime);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full">
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
        
        {/* SECTION A — Toggle Effect */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border">
          <AnimatePresence mode="sync">
            <motion.img
              key={showInput ? 'input' : `output-${outputIndex}`}
              src={showInput ? (overlayDataUrl || mannequinInput) : generatedImages[outputIndex]}
              alt={showInput ? "Input" : "Output"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 w-full h-full object-contain"
            />
          </AnimatePresence>
          
          {/* Minimal label */}
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

        {/* SECTION B — Metrics Display */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border flex flex-col items-center justify-center p-6">
          <div className="space-y-6 w-full max-w-[200px]">
            {metrics.map((metric, i) => (
              <div key={metric.label} className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    {metric.label}
                  </span>
                  <span className="text-lg font-mono font-semibold text-foreground">
                    {animatedMetrics[i].toFixed(1)}{metric.suffix}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${animatedMetrics[i]}%` }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Verified badge */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">
                Verified
              </span>
            </div>
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

          {/* Dots indicator */}
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
