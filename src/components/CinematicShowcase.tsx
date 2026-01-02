import React, { useState, useEffect, useRef, useMemo } from 'react';
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

// Anchor points for jewelry verification (normalized 0-1 positions)
const jewelryAnchors = [
  { id: 'top', x: 0.5, y: 0.28, label: 'Clasp' },
  { id: 'left', x: 0.42, y: 0.35, label: 'Left Edge' },
  { id: 'right', x: 0.58, y: 0.35, label: 'Right Edge' },
  { id: 'center', x: 0.5, y: 0.38, label: 'Center' },
  { id: 'bottom', x: 0.5, y: 0.42, label: 'Pendant' },
];

// Guide lines connecting anchors
const guideLines = [
  { from: 'top', to: 'left' },
  { from: 'top', to: 'right' },
  { from: 'left', to: 'center' },
  { from: 'right', to: 'center' },
  { from: 'center', to: 'bottom' },
];

export function CinematicShowcase() {
  const [showInput, setShowInput] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finalIndex, setFinalIndex] = useState(0);
  const [animatedValues, setAnimatedValues] = useState({ precision: 0, recall: 0, iou: 0, growth: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [jewelryEmphasisUrl, setJewelryEmphasisUrl] = useState<string>('');
  
  // Zero Alteration specific state
  const [zeroAltPhase, setZeroAltPhase] = useState<'toggle' | 'verify' | 'scan' | 'complete'>('toggle');
  const [zeroAltShowInput, setZeroAltShowInput] = useState(true);
  const [toggleCount, setToggleCount] = useState(0);
  const [showDiagram, setShowDiagram] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanActive, setScanActive] = useState(false);

  // Get theme-adaptive colors
  const themeColors = useMemo(() => {
    const theme = document.documentElement.getAttribute('data-theme') || 
                  (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    
    switch(theme) {
      case 'dark':
        return {
          primary: 'rgb(255, 255, 255)',
          primaryMuted: 'rgba(255, 255, 255, 0.3)',
          accent: 'rgba(255, 255, 255, 0.8)',
          scan: 'rgba(255, 255, 255, 0.15)',
          scanLine: 'rgba(255, 255, 255, 0.9)',
          emphasis: 'rgba(255, 255, 255, 0.08)',
        };
      case 'cyberpunk':
        return {
          primary: 'rgb(255, 0, 200)',
          primaryMuted: 'rgba(255, 0, 200, 0.3)',
          accent: 'rgba(255, 0, 200, 0.8)',
          scan: 'rgba(255, 0, 200, 0.12)',
          scanLine: 'rgba(255, 0, 200, 0.9)',
          emphasis: 'rgba(255, 0, 200, 0.06)',
        };
      case 'vintage':
        return {
          primary: 'rgb(180, 140, 80)',
          primaryMuted: 'rgba(180, 140, 80, 0.3)',
          accent: 'rgba(180, 140, 80, 0.8)',
          scan: 'rgba(180, 140, 80, 0.12)',
          scanLine: 'rgba(180, 140, 80, 0.9)',
          emphasis: 'rgba(180, 140, 80, 0.06)',
        };
      case 'nature':
        return {
          primary: 'rgb(100, 180, 100)',
          primaryMuted: 'rgba(100, 180, 100, 0.3)',
          accent: 'rgba(100, 180, 100, 0.8)',
          scan: 'rgba(100, 180, 100, 0.12)',
          scanLine: 'rgba(100, 180, 100, 0.9)',
          emphasis: 'rgba(100, 180, 100, 0.06)',
        };
      case 'ocean':
        return {
          primary: 'rgb(0, 150, 200)',
          primaryMuted: 'rgba(0, 150, 200, 0.3)',
          accent: 'rgba(0, 150, 200, 0.8)',
          scan: 'rgba(0, 150, 200, 0.12)',
          scanLine: 'rgba(0, 150, 200, 0.9)',
          emphasis: 'rgba(0, 150, 200, 0.06)',
        };
      default: // light
        return {
          primary: 'rgb(0, 0, 0)',
          primaryMuted: 'rgba(0, 0, 0, 0.25)',
          accent: 'rgba(0, 0, 0, 0.7)',
          scan: 'rgba(0, 0, 0, 0.08)',
          scanLine: 'rgba(0, 0, 0, 0.8)',
          emphasis: 'rgba(0, 0, 0, 0.04)',
        };
    }
  }, []);

  // Create soft emphasis overlay from mask (subtle glow effect)
  useEffect(() => {
    const generateEmphasis = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const maskImg = new Image();

      maskImg.onload = () => {
        canvas.width = maskImg.naturalWidth;
        canvas.height = maskImg.naturalHeight;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw mask and create soft emphasis
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        tempCtx.drawImage(maskImg, 0, 0);
        const maskData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

        // Create soft glow effect on jewelry areas
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const brightness = maskData.data[idx];
            
            if (brightness > 200) {
              // Soft radial gradient effect
              ctx.fillStyle = themeColors.emphasis;
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // Apply blur for soft edges
        ctx.filter = 'blur(8px)';
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';

        setJewelryEmphasisUrl(canvas.toDataURL('image/png'));
      };

      maskImg.src = jewelryMask;
    };

    generateEmphasis();

    const observer = new MutationObserver(generateEmphasis);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['data-theme', 'class'] 
    });

    return () => observer.disconnect();
  }, [themeColors]);

  // Zero Alteration Phase Controller
  useEffect(() => {
    // Phase 1: Toggle 3 times
    if (zeroAltPhase === 'toggle') {
      const toggleInterval = setInterval(() => {
        setZeroAltShowInput(prev => !prev);
        setToggleCount(c => c + 1);
      }, 1200);

      return () => clearInterval(toggleInterval);
    }
  }, [zeroAltPhase]);

  // Progress through phases
  useEffect(() => {
    if (toggleCount >= 6 && zeroAltPhase === 'toggle') {
      // After 3 full toggles, show diagram
      setShowDiagram(true);
      setZeroAltPhase('verify');
    }
  }, [toggleCount, zeroAltPhase]);

  useEffect(() => {
    if (zeroAltPhase === 'verify') {
      // Toggle with diagram overlay
      const verifyInterval = setInterval(() => {
        setZeroAltShowInput(prev => !prev);
      }, 1500);

      // After verification, trigger scan
      const scanTimeout = setTimeout(() => {
        clearInterval(verifyInterval);
        setZeroAltPhase('scan');
        setScanActive(true);
      }, 6000);

      return () => {
        clearInterval(verifyInterval);
        clearTimeout(scanTimeout);
      };
    }
  }, [zeroAltPhase]);

  // Scan animation
  useEffect(() => {
    if (zeroAltPhase === 'scan' && scanActive) {
      let progress = 0;
      const scanInterval = setInterval(() => {
        progress += 1.5;
        setScanProgress(progress);
        
        if (progress >= 100) {
          clearInterval(scanInterval);
          setScanActive(false);
          // End on input frame and clean up
          setTimeout(() => {
            setZeroAltShowInput(true);
            setShowDiagram(false);
            setZeroAltPhase('complete');
          }, 500);
        }
      }, 25);

      return () => clearInterval(scanInterval);
    }
  }, [zeroAltPhase, scanActive]);

  // Reset cycle after complete
  useEffect(() => {
    if (zeroAltPhase === 'complete') {
      const resetTimeout = setTimeout(() => {
        setZeroAltPhase('toggle');
        setToggleCount(0);
        setScanProgress(0);
      }, 4000);

      return () => clearTimeout(resetTimeout);
    }
  }, [zeroAltPhase]);

  // Section B: Regular toggle between input and outputs (for metrics)
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

  // Animate metrics
  useEffect(() => {
    const target = metricsPerOutput[currentIndex];
    const duration = 1200;
    const steps = 40;
    const stepTime = duration / steps;
    
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

  // Get anchor position by id
  const getAnchor = (id: string) => jewelryAnchors.find(a => a.id === id);

  return (
    <div className="w-full">
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
        
        {/* SECTION A — Zero Alteration Verification */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border">
          {/* Base Image */}
          <AnimatePresence mode="sync">
            <motion.img
              key={zeroAltShowInput ? 'za-input' : 'za-output'}
              src={zeroAltShowInput ? mannequinInput : generatedImages[0]}
              alt={zeroAltShowInput ? "Input" : "Output"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 w-full h-full object-contain"
            />
          </AnimatePresence>

          {/* Soft Emphasis Overlay (only during verify phase) */}
          {(zeroAltPhase === 'verify' || zeroAltPhase === 'scan') && jewelryEmphasisUrl && (
            <motion.img
              src={jewelryEmphasisUrl}
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-overlay"
            />
          )}

          {/* Scientific Diagram Overlay */}
          {showDiagram && zeroAltPhase !== 'complete' && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Guide Lines */}
              {guideLines.map((line, i) => {
                const from = getAnchor(line.from);
                const to = getAnchor(line.to);
                if (!from || !to) return null;
                
                return (
                  <motion.line
                    key={`line-${i}`}
                    x1={`${from.x * 100}%`}
                    y1={`${from.y * 100}%`}
                    x2={`${to.x * 100}%`}
                    y2={`${to.y * 100}%`}
                    stroke={themeColors.primaryMuted}
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    filter="url(#glow)"
                  />
                );
              })}

              {/* Anchor Points */}
              {jewelryAnchors.map((anchor, i) => (
                <motion.g key={anchor.id}>
                  {/* Outer ring */}
                  <motion.circle
                    cx={`${anchor.x * 100}%`}
                    cy={`${anchor.y * 100}%`}
                    r="8"
                    fill="none"
                    stroke={themeColors.primaryMuted}
                    strokeWidth="1"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                  />
                  {/* Inner dot */}
                  <motion.circle
                    cx={`${anchor.x * 100}%`}
                    cy={`${anchor.y * 100}%`}
                    r="3"
                    fill={themeColors.accent}
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.3, delay: 0.6 + i * 0.08 }}
                    filter="url(#glow)"
                  />
                  {/* Crosshair lines */}
                  <motion.line
                    x1={`${(anchor.x - 0.02) * 100}%`}
                    y1={`${anchor.y * 100}%`}
                    x2={`${(anchor.x + 0.02) * 100}%`}
                    y2={`${anchor.y * 100}%`}
                    stroke={themeColors.accent}
                    strokeWidth="1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    transition={{ delay: 0.8 + i * 0.08 }}
                  />
                  <motion.line
                    x1={`${anchor.x * 100}%`}
                    y1={`${(anchor.y - 0.015) * 100}%`}
                    x2={`${anchor.x * 100}%`}
                    y2={`${(anchor.y + 0.015) * 100}%`}
                    stroke={themeColors.accent}
                    strokeWidth="1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    transition={{ delay: 0.8 + i * 0.08 }}
                  />
                </motion.g>
              ))}

              {/* Bounding Box */}
              <motion.rect
                x="40%"
                y="26%"
                width="20%"
                height="18%"
                fill="none"
                stroke={themeColors.primaryMuted}
                strokeWidth="1"
                strokeDasharray="6 3"
                rx="2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 1.2 }}
              />

              {/* Scale/Position indicators at corners */}
              {[
                { x: 40, y: 26 },
                { x: 60, y: 26 },
                { x: 40, y: 44 },
                { x: 60, y: 44 }
              ].map((corner, i) => (
                <motion.g key={`corner-${i}`}>
                  <motion.line
                    x1={`${corner.x}%`}
                    y1={`${corner.y - 1.5}%`}
                    x2={`${corner.x}%`}
                    y2={`${corner.y + 1.5}%`}
                    stroke={themeColors.accent}
                    strokeWidth="1.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.8 }}
                    transition={{ delay: 1.3 + i * 0.05 }}
                  />
                  <motion.line
                    x1={`${corner.x - 1.5}%`}
                    y1={`${corner.y}%`}
                    x2={`${corner.x + 1.5}%`}
                    y2={`${corner.y}%`}
                    stroke={themeColors.accent}
                    strokeWidth="1.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.8 }}
                    transition={{ delay: 1.3 + i * 0.05 }}
                  />
                </motion.g>
              ))}
            </svg>
          )}

          {/* Verification Scan Effect */}
          {zeroAltPhase === 'scan' && (
            <>
              {/* Scan overlay that follows the line */}
              <motion.div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: 0,
                  height: `${scanProgress}%`,
                  background: `linear-gradient(to bottom, transparent 0%, ${themeColors.scan} 80%, transparent 100%)`,
                }}
              />
              
              {/* Scan line */}
              <motion.div
                className="absolute left-0 right-0 h-[2px] pointer-events-none"
                style={{
                  top: `${scanProgress}%`,
                  background: `linear-gradient(90deg, transparent, ${themeColors.scanLine}, transparent)`,
                  boxShadow: `0 0 20px 4px ${themeColors.scan}`,
                }}
              />
            </>
          )}
          
          {/* Status Label */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <AnimatePresence mode="wait">
              <motion.div
                key={zeroAltPhase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                  zeroAltPhase === 'complete'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/90 text-foreground border border-border'
                }`}
              >
                {zeroAltPhase === 'toggle' && (zeroAltShowInput ? 'Input' : 'Output')}
                {zeroAltPhase === 'verify' && 'Verifying Position'}
                {zeroAltPhase === 'scan' && 'Scanning Integrity'}
                {zeroAltPhase === 'complete' && 'Zero Alteration ✓'}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Section Title */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2">
            <span className="px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-widest text-muted-foreground bg-background/60 backdrop-blur-sm">
              Zero Alteration
            </span>
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
          
          {/* Bottom label */}
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

        {/* SECTION C — Final Clean Output (Realistic Imagery) */}
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

          {/* Section Title */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2">
            <span className="px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-widest text-muted-foreground bg-background/60 backdrop-blur-sm">
              Realistic Imagery
            </span>
          </div>

          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-1.5 mt-2">
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
