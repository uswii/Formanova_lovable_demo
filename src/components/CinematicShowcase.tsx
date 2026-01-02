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
  { precision: 99.2, recall: 98.7, iou: 97.4, growth: 94.1 },
  { precision: 98.9, recall: 99.1, iou: 96.8, growth: 95.3 },
  { precision: 99.5, recall: 98.4, iou: 97.9, growth: 93.8 },
];

export function CinematicShowcase() {
  const [showInput, setShowInput] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finalIndex, setFinalIndex] = useState(0);
  const [animatedValues, setAnimatedValues] = useState({ precision: 0, recall: 0, iou: 0, growth: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overlayDataUrl, setOverlayDataUrl] = useState<string>('');

  // Create themed overlay from mask - translucent, no filters
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
        
        // Draw base image without any filters
        ctx.drawImage(baseImg, 0, 0);

        // Get theme info
        const theme = document.documentElement.getAttribute('data-theme') || 
                      (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        
        // More solid overlay colors (~45-50% opacity)
        let overlayColor: string;
        
        switch(theme) {
          case 'dark':
            overlayColor = 'rgba(255, 255, 255, 0.45)';
            break;
          case 'cyberpunk':
            overlayColor = 'rgba(255, 0, 200, 0.5)';
            break;
          case 'vintage':
            overlayColor = 'rgba(180, 140, 80, 0.5)';
            break;
          case 'nature':
            overlayColor = 'rgba(100, 180, 100, 0.45)';
            break;
          case 'ocean':
            overlayColor = 'rgba(0, 150, 200, 0.45)';
            break;
          default: // light
            overlayColor = 'rgba(0, 0, 0, 0.4)';
        }

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) return;

        maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
        const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);

        // Simple overlay on white mask areas only
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

  // Section A: Toggle between input and outputs
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

  // Animate metrics like real-time calculation
  useEffect(() => {
    const target = metricsPerOutput[currentIndex];
    const duration = 1200;
    const steps = 40;
    const stepTime = duration / steps;
    
    // Start from slightly lower values to simulate calculation
    const startValues = {
      precision: target.precision - 15 - Math.random() * 10,
      recall: target.recall - 15 - Math.random() * 10,
      iou: target.iou - 15 - Math.random() * 10,
      growth: target.growth - 15 - Math.random() * 10,
    };
    
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      // Easing with some "jitter" to look like calculation
      const jitter = step < steps - 5 ? (Math.random() - 0.5) * 2 : 0;
      const eased = 1 - Math.pow(1 - progress, 2);
      
      setAnimatedValues({
        precision: Math.min(target.precision, startValues.precision + (target.precision - startValues.precision) * eased + jitter),
        recall: Math.min(target.recall, startValues.recall + (target.recall - startValues.recall) * eased + jitter),
        iou: Math.min(target.iou, startValues.iou + (target.iou - startValues.iou) * eased + jitter),
        growth: Math.min(target.growth, startValues.growth + (target.growth - startValues.growth) * eased + jitter),
      });
      
      if (step >= steps) {
        clearInterval(interval);
        setAnimatedValues(target); // Ensure final values are exact
      }
    }, stepTime);

    return () => clearInterval(interval);
  }, [currentIndex]);

  // Section C: Final images cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setFinalIndex(prev => (prev + 1) % generatedImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const metrics = [
    { label: 'Precision', value: animatedValues.precision },
    { label: 'Recall', value: animatedValues.recall },
    { label: 'IoU', value: animatedValues.iou },
    { label: 'Growth', value: animatedValues.growth },
  ];

  return (
    <div className="w-full">
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
        
        {/* SECTION A — Toggle Effect */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border">
          <AnimatePresence mode="sync">
            <motion.img
              key={showInput ? 'input' : `output-${currentIndex}`}
              src={showInput ? mannequinInput : generatedImages[currentIndex]}
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

        {/* SECTION B — Metrics with animated sliders */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border flex flex-col items-center justify-center p-5">
          <div className="space-y-4 w-full max-w-[220px]">
            {metrics.map((metric) => (
              <div key={metric.label} className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {metric.label}
                  </span>
                  <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
                    {metric.value.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 0.05 }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Bottom label like other sections */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
                Calculating
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

          {/* Bottom label */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="px-3 py-1 rounded-full bg-background/80 border border-border text-[10px] font-medium text-foreground uppercase tracking-wider">
              Final Result
            </div>
          </div>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5">
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
