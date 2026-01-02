import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import images
import mannequinInput from '@/assets/showcase/mannequin-input.png';
import jewelryMask from '@/assets/showcase/jewelry-mask.png';
import modelBlackDress from '@/assets/showcase/model-black-dress.png';
import modelWhiteDress from '@/assets/showcase/model-white-dress.png';
import modelBlackTank from '@/assets/showcase/model-black-tank.png';
import metrics1 from '@/assets/showcase/metrics-1.png';
import metrics2 from '@/assets/showcase/metrics-2.png';
import metrics3 from '@/assets/showcase/metrics-3.png';

const generatedImages = [modelBlackDress, modelWhiteDress, modelBlackTank];
const metricsImages = [metrics1, metrics2, metrics3];

export function CinematicShowcase() {
  const [toggleIndex, setToggleIndex] = useState(0); // 0 = input, 1-3 = generated
  const [metricsIndex, setMetricsIndex] = useState(0);
  const [finalIndex, setFinalIndex] = useState(0);
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

      // Set canvas size to match images
      canvas.width = baseImg.naturalWidth;
      canvas.height = baseImg.naturalHeight;

      // Draw base mannequin image
      ctx.drawImage(baseImg, 0, 0);

      // Get computed primary color from CSS
      const computedStyle = getComputedStyle(document.documentElement);
      const primaryHsl = computedStyle.getPropertyValue('--primary').trim();
      
      // Parse HSL and create overlay color with transparency
      const [h, s, l] = primaryHsl.split(' ').map(v => parseFloat(v));
      const overlayColor = `hsla(${h}, ${s}%, ${l}%, 0.4)`;

      // Create temporary canvas for mask processing
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) return;

      // Draw mask scaled to match
      maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
      const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);

      // Create overlay only where mask is white
      ctx.save();
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          const r = maskData.data[idx];
          const g = maskData.data[idx + 1];
          const b = maskData.data[idx + 2];
          
          // Check if pixel is white (jewelry area)
          if (r > 200 && g > 200 && b > 200) {
            ctx.fillStyle = overlayColor;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      ctx.restore();

      // Add a subtle glow border around jewelry area
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `hsla(${h}, ${s}%, ${l}%, 0.6)`;
      ctx.lineWidth = 2;
      ctx.filter = 'blur(2px)';
      
      // Trace around white areas (simplified approach - just add glow effect)
      ctx.globalCompositeOperation = 'source-atop';
      ctx.restore();

      setOverlayDataUrl(canvas.toDataURL('image/png'));
    };

    maskImg.onload = onLoad;
    baseImg.onload = onLoad;
    maskImg.src = jewelryMask;
    baseImg.src = mannequinInput;

    // Re-generate when theme changes
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

  // Section A: Toggle animation
  useEffect(() => {
    const interval = setInterval(() => {
      setToggleIndex(prev => (prev + 1) % 4);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Section B: Metrics cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setMetricsIndex(prev => (prev + 1) % metricsImages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Section C: Final images cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setFinalIndex(prev => (prev + 1) % generatedImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getSectionAImage = () => {
    if (toggleIndex === 0) {
      return overlayDataUrl || mannequinInput;
    }
    return generatedImages[toggleIndex - 1];
  };

  return (
    <div className="w-full">
      {/* Hidden canvas for overlay generation */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Landscape 3-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        
        {/* SECTION A — Zero Alterations (Toggle) */}
        <div className="relative">
          <div className="text-center mb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Zero Alterations
            </span>
          </div>
          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/30 border border-border">
            <AnimatePresence mode="wait">
              <motion.img
                key={toggleIndex}
                src={getSectionAImage()}
                alt={toggleIndex === 0 ? "Input with jewelry highlight" : "Generated output"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full object-contain"
              />
            </AnimatePresence>
            
            {/* Toggle label */}
            <motion.div 
              key={toggleIndex === 0 ? 'input' : 'output'}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2"
            >
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm ${
                toggleIndex === 0 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-background/80 text-foreground border border-border'
              }`}>
                {toggleIndex === 0 ? 'INPUT' : 'OUTPUT'}
              </div>
            </motion.div>

            {/* Jewelry unchanged indicator */}
            <div className="absolute top-3 right-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
          </div>
        </div>

        {/* SECTION B — Verified Accuracy (Metrics) */}
        <div className="relative">
          <div className="text-center mb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Verified Accuracy
            </span>
          </div>
          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/30 border border-border flex items-center justify-center p-4">
            <AnimatePresence mode="wait">
              <motion.img
                key={metricsIndex}
                src={metricsImages[metricsIndex]}
                alt="Quality verification metrics"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </AnimatePresence>

            {/* Metrics dots indicator */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {metricsImages.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    metricsIndex === i ? 'bg-primary w-4' : 'bg-muted-foreground/40'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* SECTION C — Realistic Imagery (Final) */}
        <div className="relative">
          <div className="text-center mb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Realistic Imagery
            </span>
          </div>
          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/30 border border-border">
            <AnimatePresence mode="wait">
              <motion.img
                key={finalIndex}
                src={generatedImages[finalIndex]}
                alt="Final photorealistic result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full h-full object-contain"
              />
            </AnimatePresence>

            {/* Clean result badge */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
              <div className="px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border text-xs font-medium text-foreground">
                100% Preserved
              </div>
            </div>

            {/* Final images dots */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {generatedImages.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    finalIndex === i ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
