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

export function CinematicShowcase() {
  const [showInput, setShowInput] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finalIndex, setFinalIndex] = useState(0);
  const [animatedValues, setAnimatedValues] = useState({ precision: 0, recall: 0, iou: 0, growth: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [jewelryEmphasisUrl, setJewelryEmphasisUrl] = useState<string>('');
  
  // Zero Alteration state
  const [zeroAltPhase, setZeroAltPhase] = useState<'toggle' | 'lock' | 'complete'>('toggle');
  const [zeroAltShowInput, setZeroAltShowInput] = useState(true);
  const [toggleCount, setToggleCount] = useState(0);
  const [showBrackets, setShowBrackets] = useState(false);
  const [matchPercent, setMatchPercent] = useState(0);

  // Theme colors
  const themeColors = useMemo(() => {
    const theme = document.documentElement.getAttribute('data-theme') || 
                  (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    
    switch(theme) {
      case 'dark':
        return { accent: 'rgba(255, 255, 255, 0.9)', muted: 'rgba(255, 255, 255, 0.3)', emphasis: 'rgba(255, 255, 255, 0.12)' };
      case 'cyberpunk':
        return { accent: 'rgba(255, 0, 200, 0.9)', muted: 'rgba(255, 0, 200, 0.3)', emphasis: 'rgba(255, 0, 200, 0.1)' };
      case 'vintage':
        return { accent: 'rgba(180, 140, 80, 0.9)', muted: 'rgba(180, 140, 80, 0.3)', emphasis: 'rgba(180, 140, 80, 0.1)' };
      case 'nature':
        return { accent: 'rgba(100, 180, 100, 0.9)', muted: 'rgba(100, 180, 100, 0.3)', emphasis: 'rgba(100, 180, 100, 0.1)' };
      case 'ocean':
        return { accent: 'rgba(0, 150, 200, 0.9)', muted: 'rgba(0, 150, 200, 0.3)', emphasis: 'rgba(0, 150, 200, 0.1)' };
      default:
        return { accent: 'rgba(0, 0, 0, 0.8)', muted: 'rgba(0, 0, 0, 0.2)', emphasis: 'rgba(0, 0, 0, 0.06)' };
    }
  }, []);

  // Create emphasis overlay
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        tempCtx.drawImage(maskImg, 0, 0);
        const maskData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = themeColors.emphasis;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            if (maskData.data[idx] > 200) {
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }

        ctx.filter = 'blur(4px)';
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
        setJewelryEmphasisUrl(canvas.toDataURL('image/png'));
      };
      maskImg.src = jewelryMask;
    };

    generateEmphasis();
    const observer = new MutationObserver(generateEmphasis);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => observer.disconnect();
  }, [themeColors]);

  // Phase 1: Toggle
  useEffect(() => {
    if (zeroAltPhase === 'toggle') {
      const interval = setInterval(() => {
        setZeroAltShowInput(prev => !prev);
        setToggleCount(c => c + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [zeroAltPhase]);

  // Transition to lock phase
  useEffect(() => {
    if (toggleCount >= 6 && zeroAltPhase === 'toggle') {
      setShowBrackets(true);
      setZeroAltPhase('lock');
    }
  }, [toggleCount, zeroAltPhase]);

  // Phase 2: Lock with match percentage
  useEffect(() => {
    if (zeroAltPhase === 'lock') {
      // Continue toggling
      const toggleInterval = setInterval(() => {
        setZeroAltShowInput(prev => !prev);
      }, 1200);

      // Animate match percentage
      let percent = 0;
      const percentInterval = setInterval(() => {
        percent += 2;
        setMatchPercent(Math.min(percent, 100));
        if (percent >= 100) clearInterval(percentInterval);
      }, 40);

      // Complete after animation
      const completeTimeout = setTimeout(() => {
        clearInterval(toggleInterval);
        setZeroAltShowInput(true);
        setZeroAltPhase('complete');
      }, 5000);

      return () => {
        clearInterval(toggleInterval);
        clearInterval(percentInterval);
        clearTimeout(completeTimeout);
      };
    }
  }, [zeroAltPhase]);

  // Reset cycle
  useEffect(() => {
    if (zeroAltPhase === 'complete') {
      const timeout = setTimeout(() => {
        setZeroAltPhase('toggle');
        setToggleCount(0);
        setShowBrackets(false);
        setMatchPercent(0);
      }, 4000);
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

  // Section C cycle
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

  // Physics-style reference overlay - minimal alignment graphics
  const PhysicsReferenceOverlay = () => {
    return (
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Vertical center alignment line */}
          <line 
            x1="50" y1="20" x2="50" y2="80" 
            stroke={themeColors.muted} 
            strokeWidth="0.15" 
            strokeDasharray="1,1"
          />
          {/* Horizontal alignment line through jewelry area */}
          <line 
            x1="30" y1="38" x2="70" y2="38" 
            stroke={themeColors.muted} 
            strokeWidth="0.15" 
            strokeDasharray="1,1"
          />
        </svg>
        
        {/* Anchor points - small fixed reference dots */}
        <div className="absolute" style={{ top: '32%', left: '38%' }}>
          <div 
            className="w-1.5 h-1.5 rounded-full border"
            style={{ borderColor: themeColors.accent, background: 'transparent' }}
          />
        </div>
        <div className="absolute" style={{ top: '32%', right: '38%' }}>
          <div 
            className="w-1.5 h-1.5 rounded-full border"
            style={{ borderColor: themeColors.accent, background: 'transparent' }}
          />
        </div>
        <div className="absolute" style={{ top: '44%', left: '50%', transform: 'translateX(-50%)' }}>
          <div 
            className="w-1.5 h-1.5 rounded-full border"
            style={{ borderColor: themeColors.accent, background: 'transparent' }}
          />
        </div>
        
        {/* Corner registration marks */}
        <svg className="absolute" style={{ top: '28%', left: '35%' }} width="10" height="10">
          <path d="M0 8 L0 0 L8 0" fill="none" stroke={themeColors.accent} strokeWidth="1" />
        </svg>
        <svg className="absolute" style={{ top: '28%', right: '35%' }} width="10" height="10">
          <path d="M10 0 L10 8 M2 0 L10 0" fill="none" stroke={themeColors.accent} strokeWidth="1" />
        </svg>
        <svg className="absolute" style={{ bottom: '52%', left: '35%' }} width="10" height="10">
          <path d="M0 0 L0 8 L8 8" fill="none" stroke={themeColors.accent} strokeWidth="1" />
        </svg>
        <svg className="absolute" style={{ bottom: '52%', right: '35%' }} width="10" height="10">
          <path d="M2 8 L10 8 L10 0" fill="none" stroke={themeColors.accent} strokeWidth="1" />
        </svg>
      </motion.div>
    );
  };

  // Ghost reference - faint outline that stays fixed
  const GhostReference = () => (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.15 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <img 
        src={mannequinInput} 
        alt="" 
        className="w-full h-full object-contain opacity-30 mix-blend-overlay"
        style={{ filter: 'grayscale(1) contrast(0.5)' }}
      />
    </motion.div>
  );

  return (
    <div className="w-full">
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
        
        {/* SECTION A — Zero Alteration */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border">
          <AnimatePresence mode="sync">
            <motion.img
              key={zeroAltShowInput ? 'za-input' : 'za-output'}
              src={zeroAltShowInput ? mannequinInput : generatedImages[0]}
              alt={zeroAltShowInput ? "Input" : "Output"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-0 w-full h-full object-contain"
            />
          </AnimatePresence>

          {/* Physics reference graphics - only during verification phases */}
          <AnimatePresence>
            {showBrackets && zeroAltPhase !== 'complete' && (
              <>
                <PhysicsReferenceOverlay />
                {!zeroAltShowInput && <GhostReference />}
              </>
            )}
          </AnimatePresence>

          {/* Subtle jewelry emphasis */}
          {showBrackets && jewelryEmphasisUrl && zeroAltPhase !== 'complete' && (
            <motion.img
              src={jewelryEmphasisUrl}
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          )}

          {/* Verification text label - only during lock phase */}
          <AnimatePresence>
            {zeroAltPhase === 'lock' && (
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <div 
                  className="px-4 py-2.5 rounded-lg backdrop-blur-md text-[11px] font-medium tracking-wide leading-relaxed"
                  style={{ 
                    background: 'rgba(0,0,0,0.6)',
                    color: 'rgba(255,255,255,0.95)',
                    border: `1px solid ${themeColors.muted}`
                  }}
                >
                  Same pixels. Same position.<br/>
                  <span className="text-[10px] opacity-70">Never re-rendered.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Complete checkmark */}
          {zeroAltPhase === 'complete' && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: themeColors.accent }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </motion.div>
          )}
          
          {/* Status label */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <AnimatePresence mode="wait">
              <motion.div
                key={zeroAltPhase + (zeroAltPhase === 'toggle' ? zeroAltShowInput : '')}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                  zeroAltPhase === 'complete'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/90 text-foreground border border-border'
                }`}
              >
                {zeroAltPhase === 'toggle' && (zeroAltShowInput ? 'Before' : 'After')}
                {zeroAltPhase === 'lock' && 'Verifying...'}
                {zeroAltPhase === 'complete' && 'Identical ✓'}
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

        {/* SECTION C — Final Output (clean, no overlays) */}
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
