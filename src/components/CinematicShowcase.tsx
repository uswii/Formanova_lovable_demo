import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import images
import mannequinInput from '@/assets/showcase/mannequin-input.png';
import jewelryMask from '@/assets/showcase/jewelry-mask.png';
import modelBlackDress from '@/assets/showcase/model-black-dress.png';
import modelWhiteDress from '@/assets/showcase/model-white-dress.png';
import modelBlackTank from '@/assets/showcase/model-black-tank.png';

const generatedImages = [modelBlackDress, modelWhiteDress, modelBlackTank];

const metricsPerOutput = [
  { precision: 99.2, recall: 98.7, iou: 97.4, growth: 94.1 },
  { precision: 98.9, recall: 99.1, iou: 96.8, growth: 95.3 },
  { precision: 99.5, recall: 98.4, iou: 97.9, growth: 93.8 },
];

// Jewelry landmark points derived from mask (normalized 0-100)
interface LandmarkPoint { x: number; y: number; type: 'anchor' | 'corner' }

export function CinematicShowcase() {
  const [showInput, setShowInput] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animatedValues, setAnimatedValues] = useState({ precision: 0, recall: 0, iou: 0, growth: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [jewelryEmphasisUrl, setJewelryEmphasisUrl] = useState<string>('');
  
  // Mask-derived landmarks (bounding box corners + center anchors)
  const [jewelryLandmarks, setJewelryLandmarks] = useState<LandmarkPoint[]>([]);
  const [jewelryBounds, setJewelryBounds] = useState({ minX: 0, minY: 0, maxX: 100, maxY: 100, centerX: 50, centerY: 50 });
  
  // Zero Alteration state
  const [zeroAltPhase, setZeroAltPhase] = useState<'start' | 'verify' | 'complete'>('start');
  const [zeroAltOutputIndex, setZeroAltOutputIndex] = useState(0);

  // Track current theme for reactivity
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

  // Theme colors - matching each theme's primary identity
  const themeColors = useMemo(() => {
    switch(currentTheme) {
      case 'dark':
        // Pure white accent on black - light overlay
        return { accent: 'rgba(255, 255, 255, 0.95)', muted: 'rgba(255, 255, 255, 0.4)', jewelryColor: 'rgba(255, 255, 255, 0.85)', bgOverlay: 'rgba(0, 0, 0, 0.25)' };
      case 'cyberpunk':
        // Magenta/Pink primary with deep purple bg - light overlay
        return { accent: 'rgba(255, 0, 180, 0.95)', muted: 'rgba(255, 0, 180, 0.4)', jewelryColor: 'rgba(255, 0, 180, 0.85)', bgOverlay: 'rgba(50, 0, 80, 0.3)' };
      case 'vintage':
        // Warm rust/terracotta with cream bg - light overlay
        return { accent: 'rgba(180, 90, 60, 0.95)', muted: 'rgba(180, 90, 60, 0.4)', jewelryColor: 'rgba(180, 90, 60, 0.85)', bgOverlay: 'rgba(240, 230, 210, 0.3)' };
      case 'nature':
        // Green primary with earthy bg - light overlay
        return { accent: 'rgba(80, 180, 100, 0.95)', muted: 'rgba(80, 180, 100, 0.4)', jewelryColor: 'rgba(80, 180, 100, 0.85)', bgOverlay: 'rgba(30, 60, 40, 0.25)' };
      case 'ocean':
        // Teal/cyan primary with deep blue bg - light overlay
        return { accent: 'rgba(0, 180, 200, 0.95)', muted: 'rgba(0, 180, 200, 0.4)', jewelryColor: 'rgba(0, 180, 200, 0.85)', bgOverlay: 'rgba(0, 40, 70, 0.28)' };
      case 'kawaii':
        // Sakura pink primary with soft pink bg - light overlay
        return { accent: 'rgba(240, 120, 160, 0.95)', muted: 'rgba(240, 120, 160, 0.4)', jewelryColor: 'rgba(240, 120, 160, 0.85)', bgOverlay: 'rgba(255, 220, 235, 0.35)' };
      case 'fashion':
        // Gold primary with black bg - light overlay
        return { accent: 'rgba(220, 180, 80, 0.95)', muted: 'rgba(220, 180, 80, 0.4)', jewelryColor: 'rgba(220, 180, 80, 0.85)', bgOverlay: 'rgba(5, 5, 5, 0.3)' };
      case 'luxury':
        // Rose gold primary with burgundy bg - light overlay
        return { accent: 'rgba(210, 140, 120, 0.95)', muted: 'rgba(210, 140, 120, 0.4)', jewelryColor: 'rgba(210, 140, 120, 0.85)', bgOverlay: 'rgba(60, 20, 30, 0.28)' };
      case 'retro':
        // Green terminal with dark blue bg - light overlay
        return { accent: 'rgba(0, 255, 100, 0.95)', muted: 'rgba(0, 255, 100, 0.4)', jewelryColor: 'rgba(0, 255, 100, 0.85)', bgOverlay: 'rgba(20, 25, 40, 0.3)' };
      case 'synthwave':
        // Hot pink/magenta with purple bg - light overlay
        return { accent: 'rgba(255, 60, 150, 0.95)', muted: 'rgba(255, 60, 150, 0.4)', jewelryColor: 'rgba(255, 60, 150, 0.85)', bgOverlay: 'rgba(40, 15, 60, 0.3)' };
      default:
        // Light theme - black accent with light gray bg - light overlay
        return { accent: 'rgba(0, 0, 0, 0.9)', muted: 'rgba(0, 0, 0, 0.35)', jewelryColor: 'rgba(0, 0, 0, 0.8)', bgOverlay: 'rgba(200, 200, 200, 0.35)' };
    }
  }, [currentTheme]);

  // Extract jewelry region and landmarks from mask
  useEffect(() => {
    const extractLandmarks = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const maskImg = new Image();
      maskImg.onload = () => {
        canvas.width = maskImg.naturalWidth;
        canvas.height = maskImg.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(maskImg, 0, 0);
        
        const maskData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const w = canvas.width;
        const h = canvas.height;
        
        // Find bounding box of jewelry region
        let minX = w, minY = h, maxX = 0, maxY = 0;
        const jewelryPixels: { x: number; y: number }[] = [];
        
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            if (maskData.data[idx] > 200) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
              jewelryPixels.push({ x, y });
            }
          }
        }
        
        if (jewelryPixels.length === 0) return;
        
        // Normalize to percentage coordinates
        const normMinX = (minX / w) * 100;
        const normMinY = (minY / h) * 100;
        const normMaxX = (maxX / w) * 100;
        const normMaxY = (maxY / h) * 100;
        const centerX = (normMinX + normMaxX) / 2;
        const centerY = (normMinY + normMaxY) / 2;
        
        setJewelryBounds({ minX: normMinX, minY: normMinY, maxX: normMaxX, maxY: normMaxY, centerX, centerY });
        
        // Generate landmark points: corners + edge midpoints + center
        const landmarks: LandmarkPoint[] = [
          { x: normMinX, y: normMinY, type: 'corner' },
          { x: normMaxX, y: normMinY, type: 'corner' },
          { x: normMinX, y: normMaxY, type: 'corner' },
          { x: normMaxX, y: normMaxY, type: 'corner' },
          { x: centerX, y: normMinY, type: 'anchor' },
          { x: centerX, y: normMaxY, type: 'anchor' },
          { x: normMinX, y: centerY, type: 'anchor' },
          { x: normMaxX, y: centerY, type: 'anchor' },
        ];
        
        setJewelryLandmarks(landmarks);
        
        // Create two-color overlay: jewelry in one color, background in another
        ctx.clearRect(0, 0, w, h);
        
        // First fill entire canvas with translucent background color
        ctx.fillStyle = themeColors.bgOverlay;
        ctx.fillRect(0, 0, w, h);
        
        // Then draw jewelry region in solid jewelry color (cut out bg and fill)
        ctx.globalCompositeOperation = 'destination-out';
        for (const pixel of jewelryPixels) {
          ctx.fillRect(pixel.x, pixel.y, 1, 1);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = themeColors.jewelryColor;
        for (const pixel of jewelryPixels) {
          ctx.fillRect(pixel.x, pixel.y, 1, 1);
        }
        
        setJewelryEmphasisUrl(canvas.toDataURL('image/png'));
      };
      maskImg.src = jewelryMask;
    };

    extractLandmarks();
  }, [themeColors]);

  // Zero Alteration flow: start -> verify (with overlay cycling through outputs) -> complete -> restart
  useEffect(() => {
    if (zeroAltPhase === 'start') {
      // Show original for 2 seconds, then move to verify
      const timeout = setTimeout(() => {
        setZeroAltPhase('verify');
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [zeroAltPhase]);

  useEffect(() => {
    if (zeroAltPhase === 'verify') {
      // Cycle through all outputs with overlay
      const cycleInterval = setInterval(() => {
        setZeroAltOutputIndex(i => (i + 1) % generatedImages.length);
      }, 1500);

      // After cycling through all, complete
      const completeTimeout = setTimeout(() => {
        clearInterval(cycleInterval);
        setZeroAltPhase('complete');
      }, 1500 * generatedImages.length + 500);

      return () => {
        clearInterval(cycleInterval);
        clearTimeout(completeTimeout);
      };
    }
  }, [zeroAltPhase]);

  useEffect(() => {
    if (zeroAltPhase === 'complete') {
      // Show tick for 2 seconds, then restart
      const timeout = setTimeout(() => {
        setZeroAltOutputIndex(0);
        setZeroAltPhase('start');
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [zeroAltPhase]);

  // Section B toggle
  useEffect(() => {
    const interval = setInterval(() => {
      setShowInput(prev => {
        if (prev) return false;
        setCurrentIndex(i => (i + 1) % generatedImages.length);
        return true;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Metrics animation
  useEffect(() => {
    const target = metricsPerOutput[currentIndex];
    const steps = 40;
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
        setAnimatedValues(target);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [currentIndex]);


  const metrics = [
    { label: 'Precision', value: animatedValues.precision },
    { label: 'Recall', value: animatedValues.recall },
    { label: 'IoU', value: animatedValues.iou },
    { label: 'Growth', value: animatedValues.growth },
  ];

  // Mask-derived physics reference overlay - locked to jewelry region
  const MaskDerivedReferenceOverlay = () => {
    const { minX, minY, maxX, maxY, centerX, centerY } = jewelryBounds;
    const padding = 2; // Small padding around jewelry region
    
    return (
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Alignment guides - vertical and horizontal through jewelry center - more prominent */}
          <line 
            x1={centerX} y1={Math.max(0, minY - 12)} 
            x2={centerX} y2={Math.min(100, maxY + 12)} 
            stroke={themeColors.accent} 
            strokeWidth="0.35" 
            strokeDasharray="1.5,1"
          />
          <line 
            x1={Math.max(0, minX - 12)} y1={centerY} 
            x2={Math.min(100, maxX + 12)} y2={centerY} 
            stroke={themeColors.accent} 
            strokeWidth="0.35" 
            strokeDasharray="1.5,1"
          />
          
          {/* Corner registration marks - locked to jewelry bounding box - thicker */}
          {/* Top-left */}
          <path 
            d={`M${minX - padding} ${minY - padding + 4} L${minX - padding} ${minY - padding} L${minX - padding + 4} ${minY - padding}`} 
            fill="none" stroke={themeColors.accent} strokeWidth="0.5" 
          />
          {/* Top-right */}
          <path 
            d={`M${maxX + padding - 4} ${minY - padding} L${maxX + padding} ${minY - padding} L${maxX + padding} ${minY - padding + 4}`} 
            fill="none" stroke={themeColors.accent} strokeWidth="0.5" 
          />
          {/* Bottom-left */}
          <path 
            d={`M${minX - padding} ${maxY + padding - 4} L${minX - padding} ${maxY + padding} L${minX - padding + 4} ${maxY + padding}`} 
            fill="none" stroke={themeColors.accent} strokeWidth="0.5" 
          />
          {/* Bottom-right */}
          <path 
            d={`M${maxX + padding - 4} ${maxY + padding} L${maxX + padding} ${maxY + padding} L${maxX + padding} ${maxY + padding - 4}`} 
            fill="none" stroke={themeColors.accent} strokeWidth="0.5" 
          />
        </svg>
        
        {/* Intuitive crosshair-style anchor points at mask-derived landmarks */}
        {jewelryLandmarks.map((landmark, i) => (
          <div 
            key={i}
            className="absolute"
            style={{ 
              left: `${landmark.x}%`, 
              top: `${landmark.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {/* Crosshair style marker */}
            <svg width="16" height="16" viewBox="0 0 16 16" className="overflow-visible">
              {/* Horizontal line */}
              <line x1="0" y1="8" x2="16" y2="8" stroke={themeColors.accent} strokeWidth="1.5" />
              {/* Vertical line */}
              <line x1="8" y1="0" x2="8" y2="16" stroke={themeColors.accent} strokeWidth="1.5" />
              {/* Center dot */}
              <circle cx="8" cy="8" r="2.5" fill={themeColors.accent} />
            </svg>
          </div>
        ))}
      </motion.div>
    );
  };


  return (
    <div className="w-full">
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
        
        {/* SECTION A — Zero Alteration */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border">
          {/* Base image - original at start/complete, output during verify */}
          <AnimatePresence mode="sync">
            <motion.img
              key={zeroAltPhase === 'verify' ? `za-output-${zeroAltOutputIndex}` : 'za-input'}
              src={zeroAltPhase === 'verify' ? generatedImages[zeroAltOutputIndex] : mannequinInput}
              alt={zeroAltPhase === 'verify' ? `Output ${zeroAltOutputIndex + 1}` : "Original"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 w-full h-full object-contain"
            />
          </AnimatePresence>

          {/* Overlay + Landmarks only during verify phase */}
          <AnimatePresence>
            {zeroAltPhase === 'verify' && (
              <>
                {/* Two-color overlay: jewelry highlighted, background dimmed */}
                {jewelryEmphasisUrl && (
                  <motion.img
                    src={jewelryEmphasisUrl}
                    alt=""
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />
                )}
                {/* Landmarks */}
                <MaskDerivedReferenceOverlay />
              </>
            )}
          </AnimatePresence>

          {/* Complete checkmark */}
          <AnimatePresence>
            {zeroAltPhase === 'complete' && (
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center border-2"
                  style={{ 
                    background: themeColors.jewelryColor,
                    borderColor: themeColors.accent
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-background">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Status label */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <AnimatePresence mode="wait">
              <motion.div
                key={zeroAltPhase}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-medium tracking-wide text-center ${
                  zeroAltPhase === 'complete'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/90 text-foreground border border-border'
                }`}
              >
                {zeroAltPhase === 'start' && 'Original'}
                {zeroAltPhase === 'verify' && 'Checking... did it shift?'}
                {zeroAltPhase === 'complete' && 'No. Never shifted, never altered.'}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* SECTION B — Metrics */}
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
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 0.05 }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
                Calculating
              </span>
            </div>
          </div>
        </div>

        {/* SECTION C — Final Output (synced with Section A, left-to-right reveal) */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border">
          <AnimatePresence mode="wait">
            <motion.div
              key={zeroAltOutputIndex}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            >
              <img
                src={generatedImages[zeroAltOutputIndex]}
                alt="Final result"
                className="w-full h-full object-contain"
              />
            </motion.div>
          </AnimatePresence>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="px-3 py-1 rounded-full bg-background/80 border border-border text-[10px] font-medium text-foreground uppercase tracking-wider">
              Final Result
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
