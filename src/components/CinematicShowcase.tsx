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

  // Registration bracket component
  const RegistrationBracket = ({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) => {
    const isTop = position.startsWith('t');
    const isLeft = position.endsWith('l');
    const size = 12;
    
    return (
      <motion.svg
        className="absolute pointer-events-none"
        width={size + 4}
        height={size + 4}
        style={{
          [isTop ? 'top' : 'bottom']: '28%',
          [isLeft ? 'left' : 'right']: '38%',
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: position === 'tl' ? 0 : position === 'tr' ? 0.1 : position === 'bl' ? 0.2 : 0.3 }}
      >
        <path
          d={isTop && isLeft ? `M2 ${size} L2 2 L${size} 2` :
             isTop && !isLeft ? `M2 2 L${size} 2 L${size} ${size}` :
             !isTop && isLeft ? `M2 2 L2 ${size} L${size} ${size}` :
             `M2 ${size} L${size} ${size} L${size} 2`}
          fill="none"
          stroke={themeColors.accent}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </motion.svg>
    );
  };

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

          {/* Subtle jewelry emphasis */}
          {showBrackets && jewelryEmphasisUrl && (
            <motion.img
              src={jewelryEmphasisUrl}
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          )}

          {/* Registration brackets - stay fixed to prove no shift */}
          {showBrackets && zeroAltPhase !== 'complete' && (
            <>
              <RegistrationBracket position="tl" />
              <RegistrationBracket position="tr" />
              <RegistrationBracket position="bl" />
              <RegistrationBracket position="br" />
            </>
          )}

          {/* Match percentage indicator */}
          {zeroAltPhase === 'lock' && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div 
                className="w-20 h-20 rounded-full border-2 flex items-center justify-center backdrop-blur-sm"
                style={{ 
                  borderColor: themeColors.accent,
                  background: `conic-gradient(${themeColors.accent} ${matchPercent * 3.6}deg, transparent 0deg)`,
                }}
              >
                <div className="w-16 h-16 rounded-full bg-background/90 flex items-center justify-center">
                  <span 
                    className="text-lg font-bold font-mono"
                    style={{ color: themeColors.accent }}
                  >
                    {matchPercent}%
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Complete checkmark */}
          {zeroAltPhase === 'complete' && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: themeColors.accent }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
                {zeroAltPhase === 'lock' && 'Matching...'}
                {zeroAltPhase === 'complete' && 'Identical ✓'}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute top-3 left-1/2 -translate-x-1/2">
            <span className="px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-widest text-muted-foreground bg-background/60 backdrop-blur-sm">
              Zero Alteration
            </span>
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

        {/* SECTION C — Final Output */}
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

          <div className="absolute top-3 left-1/2 -translate-x-1/2">
            <span className="px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-widest text-muted-foreground bg-background/60 backdrop-blur-sm">
              Realistic Imagery
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
