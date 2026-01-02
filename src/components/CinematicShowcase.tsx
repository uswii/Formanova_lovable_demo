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
          primaryMuted: 'rgba(255, 255, 255, 0.5)',
          accent: 'rgba(255, 255, 255, 0.9)',
          scan: 'rgba(255, 255, 255, 0.2)',
          scanLine: 'rgba(255, 255, 255, 0.95)',
          emphasis: 'rgba(255, 255, 255, 0.25)',
        };
      case 'cyberpunk':
        return {
          primary: 'rgb(255, 0, 200)',
          primaryMuted: 'rgba(255, 0, 200, 0.5)',
          accent: 'rgba(255, 0, 200, 0.9)',
          scan: 'rgba(255, 0, 200, 0.2)',
          scanLine: 'rgba(255, 0, 200, 0.95)',
          emphasis: 'rgba(255, 0, 200, 0.2)',
        };
      case 'vintage':
        return {
          primary: 'rgb(180, 140, 80)',
          primaryMuted: 'rgba(180, 140, 80, 0.5)',
          accent: 'rgba(180, 140, 80, 0.9)',
          scan: 'rgba(180, 140, 80, 0.2)',
          scanLine: 'rgba(180, 140, 80, 0.95)',
          emphasis: 'rgba(180, 140, 80, 0.2)',
        };
      case 'nature':
        return {
          primary: 'rgb(100, 180, 100)',
          primaryMuted: 'rgba(100, 180, 100, 0.5)',
          accent: 'rgba(100, 180, 100, 0.9)',
          scan: 'rgba(100, 180, 100, 0.2)',
          scanLine: 'rgba(100, 180, 100, 0.95)',
          emphasis: 'rgba(100, 180, 100, 0.2)',
        };
      case 'ocean':
        return {
          primary: 'rgb(0, 150, 200)',
          primaryMuted: 'rgba(0, 150, 200, 0.5)',
          accent: 'rgba(0, 150, 200, 0.9)',
          scan: 'rgba(0, 150, 200, 0.2)',
          scanLine: 'rgba(0, 150, 200, 0.95)',
          emphasis: 'rgba(0, 150, 200, 0.2)',
        };
      default: // light
        return {
          primary: 'rgb(0, 0, 0)',
          primaryMuted: 'rgba(0, 0, 0, 0.4)',
          accent: 'rgba(0, 0, 0, 0.85)',
          scan: 'rgba(0, 0, 0, 0.12)',
          scanLine: 'rgba(0, 0, 0, 0.9)',
          emphasis: 'rgba(0, 0, 0, 0.15)',
        };
    }
  }, []);

  // Create solid emphasis overlay from mask
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

        // Create more solid overlay on jewelry areas
        ctx.fillStyle = themeColors.emphasis;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const brightness = maskData.data[idx];
            
            if (brightness > 200) {
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }

        // Slight blur for soft edges
        ctx.filter = 'blur(3px)';
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
    if (zeroAltPhase === 'toggle') {
      const toggleInterval = setInterval(() => {
        setZeroAltShowInput(prev => !prev);
        setToggleCount(c => c + 1);
      }, 1200);

      return () => clearInterval(toggleInterval);
    }
  }, [zeroAltPhase]);

  useEffect(() => {
    if (toggleCount >= 6 && zeroAltPhase === 'toggle') {
      setShowDiagram(true);
      setZeroAltPhase('verify');
    }
  }, [toggleCount, zeroAltPhase]);

  useEffect(() => {
    if (zeroAltPhase === 'verify') {
      const verifyInterval = setInterval(() => {
        setZeroAltShowInput(prev => !prev);
      }, 1500);

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

  useEffect(() => {
    if (zeroAltPhase === 'scan' && scanActive) {
      let progress = 0;
      const scanInterval = setInterval(() => {
        progress += 1.5;
        setScanProgress(progress);
        
        if (progress >= 100) {
          clearInterval(scanInterval);
          setScanActive(false);
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

  // Section B toggle
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

          {/* Solid Emphasis Overlay */}
          {(zeroAltPhase === 'verify' || zeroAltPhase === 'scan') && jewelryEmphasisUrl && (
            <motion.img
              src={jewelryEmphasisUrl}
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          )}

          {/* Physicist-Style Diagram Overlay */}
          {showDiagram && zeroAltPhase !== 'complete' && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
              {/* Horizontal Reference Line through jewelry center */}
              <motion.line
                x1="25%"
                y1="35%"
                x2="75%"
                y2="35%"
                stroke={themeColors.primaryMuted}
                strokeWidth="1"
                strokeDasharray="8 4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              />
              
              {/* Vertical Reference Line through jewelry center */}
              <motion.line
                x1="50%"
                y1="20%"
                x2="50%"
                y2="50%"
                stroke={themeColors.primaryMuted}
                strokeWidth="1"
                strokeDasharray="8 4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              />

              {/* Left Arrow - pointing inward to jewelry */}
              <motion.g
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <line
                  x1="28%"
                  y1="35%"
                  x2="38%"
                  y2="35%"
                  stroke={themeColors.accent}
                  strokeWidth="2"
                />
                <polygon
                  points="0,-4 8,0 0,4"
                  fill={themeColors.accent}
                  transform="translate(152, 140) rotate(0)"
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                />
                {/* Δx = 0 label */}
                <text
                  x="33%"
                  y="32%"
                  fill={themeColors.accent}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  Δx = 0
                </text>
              </motion.g>

              {/* Right Arrow - pointing inward to jewelry */}
              <motion.g
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <line
                  x1="72%"
                  y1="35%"
                  x2="62%"
                  y2="35%"
                  stroke={themeColors.accent}
                  strokeWidth="2"
                />
                <polygon
                  points="0,-4 -8,0 0,4"
                  fill={themeColors.accent}
                  transform="translate(248, 140) rotate(0)"
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                />
              </motion.g>

              {/* Top Arrow - pointing down to jewelry */}
              <motion.g
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                <line
                  x1="50%"
                  y1="22%"
                  x2="50%"
                  y2="28%"
                  stroke={themeColors.accent}
                  strokeWidth="2"
                />
                <polygon
                  points="-4,0 0,8 4,0"
                  fill={themeColors.accent}
                  transform="translate(200, 112)"
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                />
                {/* Δy = 0 label */}
                <text
                  x="57%"
                  y="25%"
                  fill={themeColors.accent}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="start"
                >
                  Δy = 0
                </text>
              </motion.g>

              {/* Bottom Arrow - pointing up to jewelry */}
              <motion.g
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <line
                  x1="50%"
                  y1="48%"
                  x2="50%"
                  y2="42%"
                  stroke={themeColors.accent}
                  strokeWidth="2"
                />
                <polygon
                  points="-4,0 0,-8 4,0"
                  fill={themeColors.accent}
                  transform="translate(200, 168)"
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                />
              </motion.g>

              {/* Scale indicator - double-headed arrow */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.7 }}
              >
                {/* Left scale bracket */}
                <line x1="40%" y1="44%" x2="40%" y2="46%" stroke={themeColors.accent} strokeWidth="1.5" />
                <line x1="40%" y1="45%" x2="60%" y2="45%" stroke={themeColors.accent} strokeWidth="1.5" />
                <line x1="60%" y1="44%" x2="60%" y2="46%" stroke={themeColors.accent} strokeWidth="1.5" />
                
                {/* Scale = 1:1 label */}
                <text
                  x="50%"
                  y="49%"
                  fill={themeColors.accent}
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  scale 1:1
                </text>
              </motion.g>

              {/* Rotation indicator - small arc showing θ = 0° */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.8 }}
              >
                <path
                  d="M 170 125 A 15 15 0 0 1 185 140"
                  fill="none"
                  stroke={themeColors.accent}
                  strokeWidth="1.5"
                />
                <text
                  x="44%"
                  y="28%"
                  fill={themeColors.accent}
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  θ = 0°
                </text>
              </motion.g>

              {/* Center crosshair - small + at jewelry center */}
              <motion.g
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.9 }}
              >
                <line x1="48%" y1="35%" x2="52%" y2="35%" stroke={themeColors.accent} strokeWidth="2" />
                <line x1="50%" y1="33%" x2="50%" y2="37%" stroke={themeColors.accent} strokeWidth="2" />
              </motion.g>
            </svg>
          )}

          {/* Verification Scan Effect */}
          {zeroAltPhase === 'scan' && (
            <>
              <motion.div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: 0,
                  height: `${scanProgress}%`,
                  background: `linear-gradient(to bottom, transparent 0%, ${themeColors.scan} 80%, transparent 100%)`,
                }}
              />
              
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
                {zeroAltPhase === 'verify' && 'Verifying'}
                {zeroAltPhase === 'scan' && 'Scanning'}
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

          {/* Section Title */}
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
