import React, { useRef, useEffect, useState, useCallback } from 'react';

// SAM dimensions for NECKLACE workflow only
// Necklaces use 2000x2667 (Flux pipeline) - frontend scales points
// Other jewelry sends original image coordinates - backend handles scaling via remap_click_points
const NECKLACE_SAM_WIDTH = 2000;
const NECKLACE_SAM_HEIGHT = 2667;

interface BrushStroke {
  type: 'add' | 'remove';
  points: number[][];
  radius: number;
}

interface Props {
  image: string;
  dots?: { x: number; y: number }[];
  overlayColor?: string;
  brushMode?: 'add' | 'remove';
  brushSize?: number;
  mode: 'dot' | 'brush';
  /**
   * Maximum canvas display size in pixels.
   */
  canvasSize?: number;
  /**
   * Jewelry type determines coordinate handling:
   * - Necklaces: scale to 2000x2667 SAM space
   * - Others: send original image coordinates (backend handles scaling)
   */
  jewelryType?: string;
  /**
   * Initial strokes to render on the canvas (for undo/redo support)
   */
  initialStrokes?: BrushStroke[];
  /**
   * Active stroke being drawn (for live preview)
   */
  activeStroke?: BrushStroke | null;
  onCanvasClick?: (x: number, y: number) => void;
  onCanvasChange?: (dataUrl: string) => void;
  onBrushStrokeStart?: () => void;
  onBrushStrokePoint?: (x: number, y: number) => void;
  onBrushStrokeEnd?: () => void;
}

export function MaskCanvas({
  image,
  dots = [],
  overlayColor = '#00FF00',
  brushMode = 'add',
  brushSize = 10,
  mode,
  canvasSize = 400,
  jewelryType = 'necklace',
  initialStrokes = [],
  activeStroke = null,
  onCanvasClick,
  onCanvasChange,
  onBrushStrokeStart,
  onBrushStrokePoint,
  onBrushStrokeEnd,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Store original image dimensions for non-necklace coordinate transformation
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);
  
  // Determine if this is a necklace (uses SAM scaling) or other jewelry (uses original coords)
  const isNecklace = jewelryType === 'necklace' || jewelryType === 'necklaces';
  
  // Compute display dimensions based on canvas size while preserving aspect ratio
  // We'll calculate actual dimensions once image loads, but need initial values
  const [displayWidth, setDisplayWidth] = useState(canvasSize * (3 / 4));
  const [displayHeight, setDisplayHeight] = useState(canvasSize);

  // Load and draw image - preserve aspect ratio within canvasSize constraint
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      console.log('[MaskCanvas] No canvas or context');
      return;
    }

    if (!image) {
      console.log('[MaskCanvas] No image prop provided');
      return;
    }

    console.log('[MaskCanvas] Loading image, length:', image.length, 'prefix:', image.substring(0, 50));
    setImageLoaded(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      console.log('[MaskCanvas] Image loaded, natural size:', img.naturalWidth, 'x', img.naturalHeight);
      
      // Store original dimensions for coordinate transformation
      setOriginalWidth(img.naturalWidth);
      setOriginalHeight(img.naturalHeight);
      
      // Calculate display dimensions preserving aspect ratio
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      let newDisplayWidth: number;
      let newDisplayHeight: number;
      
      if (aspectRatio > 1) {
        // Landscape or square: constrain by width
        newDisplayWidth = canvasSize;
        newDisplayHeight = canvasSize / aspectRatio;
      } else {
        // Portrait: constrain by height
        newDisplayHeight = canvasSize;
        newDisplayWidth = canvasSize * aspectRatio;
      }
      
      setDisplayWidth(newDisplayWidth);
      setDisplayHeight(newDisplayHeight);
      
      // Use device pixel ratio for sharper rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = newDisplayWidth * dpr;
      canvas.height = newDisplayHeight * dpr;
      canvas.style.width = `${newDisplayWidth}px`;
      canvas.style.height = `${newDisplayHeight}px`;

      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = newDisplayWidth * dpr;
        overlayCanvasRef.current.height = newDisplayHeight * dpr;
        overlayCanvasRef.current.style.width = `${newDisplayWidth}px`;
        overlayCanvasRef.current.style.height = `${newDisplayHeight}px`;
      }

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, newDisplayWidth, newDisplayHeight);
      
      // Draw image preserving aspect ratio (no stretching)
      ctx.drawImage(img, 0, 0, newDisplayWidth, newDisplayHeight);
      
      setImageLoaded(true);
      console.log('[MaskCanvas] Image drawn to canvas with aspect ratio:', aspectRatio.toFixed(2));
    };
    img.onerror = (e) => {
      console.error('[MaskCanvas] Failed to load image:', e);
    };
    img.src = image;
  }, [image, canvasSize]);

  // Transform display coordinates to output space
  // - Necklaces: scale to SAM space (2000x2667)
  // - Other jewelry: scale to original image coordinates (backend handles remap)
  const toOutputSpace = useCallback((xDisplay: number, yDisplay: number) => {
    if (displayWidth === 0 || displayHeight === 0) {
      return { x: xDisplay, y: yDisplay };
    }
    
    if (isNecklace) {
      // Necklace: scale to SAM dimensions
      const samX = (xDisplay / displayWidth) * NECKLACE_SAM_WIDTH;
      const samY = (yDisplay / displayHeight) * NECKLACE_SAM_HEIGHT;
      console.log('toOutputSpace (necklace→SAM):', { xDisplay, yDisplay, samX, samY });
      return { x: samX, y: samY };
    } else {
      // Other jewelry: scale to original image coordinates
      if (originalWidth === 0 || originalHeight === 0) {
        return { x: xDisplay, y: yDisplay };
      }
      const origX = (xDisplay / displayWidth) * originalWidth;
      const origY = (yDisplay / displayHeight) * originalHeight;
      console.log('toOutputSpace (other→original):', { xDisplay, yDisplay, origX, origY, originalWidth, originalHeight });
      return { x: origX, y: origY };
    }
  }, [displayWidth, displayHeight, originalWidth, originalHeight, isNecklace]);

  // Transform output coordinates back to display space (for rendering dots/strokes)
  const toDisplaySpace = useCallback((xOut: number, yOut: number) => {
    if (isNecklace) {
      // Necklace: from SAM space
      return {
        x: (xOut / NECKLACE_SAM_WIDTH) * displayWidth,
        y: (yOut / NECKLACE_SAM_HEIGHT) * displayHeight,
      };
    } else {
      // Other jewelry: from original image space
      if (originalWidth === 0 || originalHeight === 0) {
        return { x: xOut, y: yOut };
      }
      return {
        x: (xOut / originalWidth) * displayWidth,
        y: (yOut / originalHeight) * displayHeight,
      };
    }
  }, [displayWidth, displayHeight, originalWidth, originalHeight, isNecklace]);

  // Convert hex to rgba
  const hexToRgba = useCallback((hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  // Draw initial strokes + active stroke when image loads or strokes change (for live preview)
  useEffect(() => {
    if (!imageLoaded || mode !== 'brush') return;

    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    
    // Clear and reset
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.scale(dpr, dpr);

    // Helper to draw a smooth stroke as connected lines
    const drawSmoothStroke = (points: number[][], radius: number, isEraser: boolean) => {
      if (points.length === 0) return;
      
      // For eraser, use destination-out to reveal original image
      if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(255,255,255,1)';
        ctx.fillStyle = 'rgba(255,255,255,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = hexToRgba(overlayColor, 0.5);
        ctx.fillStyle = hexToRgba(overlayColor, 0.5);
      }
      
      ctx.lineWidth = radius;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (points.length === 1) {
        // Single point - draw a dot
        const displayPt = toDisplaySpace(points[0][0], points[0][1]);
        ctx.beginPath();
        ctx.arc(displayPt.x, displayPt.y, radius / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        return;
      }
      
      // Multiple points - draw connected line
      ctx.beginPath();
      const firstPt = toDisplaySpace(points[0][0], points[0][1]);
      ctx.moveTo(firstPt.x, firstPt.y);
      
      for (let i = 1; i < points.length; i++) {
        const pt = toDisplaySpace(points[i][0], points[i][1]);
        ctx.lineTo(pt.x, pt.y);
      }
      
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    };
    
    // Draw all initial strokes - each stroke keeps its own type
    initialStrokes.forEach((stroke) => {
      drawSmoothStroke(stroke.points, stroke.radius, stroke.type === 'remove');
    });

    // Draw active stroke for live preview
    if (activeStroke && activeStroke.points.length > 0) {
      drawSmoothStroke(activeStroke.points, activeStroke.radius, activeStroke.type === 'remove');
    }
  }, [imageLoaded, initialStrokes, activeStroke, mode, toDisplaySpace, overlayColor, hexToRgba]);

  // Draw dots for marking mode (dots are in output space - SAM for necklace, original for others)
  useEffect(() => {
    if (mode !== 'dot' || !imageLoaded) return;
    
    // For non-necklace jewelry, wait until original dimensions are available
    // This prevents dots from rendering in wrong positions before image loads
    if (!isNecklace && (originalWidth === 0 || originalHeight === 0)) {
      console.log('[MaskCanvas] Waiting for original dimensions to render dots');
      return;
    }

    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.scale(dpr, dpr);

    // Draw dots - solid red with white border (original style)
    dots.forEach((dot) => {
      const displayPt = toDisplaySpace(dot.x, dot.y);
      console.log('[MaskCanvas] Drawing dot:', { original: dot, display: displayPt });
      ctx.beginPath();
      ctx.arc(displayPt.x, displayPt.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#FF0000';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [dots, brushSize, mode, imageLoaded, toDisplaySpace, isNecklace, originalWidth, originalHeight]);

  // Get coordinates from mouse/touch event and transform to SAM space
  const getCanvasCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Get display coordinates
    const xDisplay = clientX - rect.left;
    const yDisplay = clientY - rect.top;

    // Transform to output space (SAM for necklace, original for others)
    return toOutputSpace(xDisplay, yDisplay);
  }, [toOutputSpace]);

  // Store last point for smooth line drawing
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Draw a point or line segment on the canvas (x, y are in output space)
  const draw = useCallback((x: number, y: number) => {
    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayPt = toDisplaySpace(x, y);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    // For eraser, use destination-out to reveal original; for add, use normal drawing
    if (brushMode === 'remove') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.fillStyle = 'rgba(255,255,255,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      const drawColor = hexToRgba(overlayColor, 0.5);
      ctx.strokeStyle = drawColor;
      ctx.fillStyle = drawColor;
    }
    
    if (lastPointRef.current) {
      // Draw line from last point to current point for smooth strokes
      const lastDisplayPt = toDisplaySpace(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastDisplayPt.x, lastDisplayPt.y);
      ctx.lineTo(displayPt.x, displayPt.y);
      ctx.stroke();
    } else {
      // First point - draw a dot
      ctx.beginPath();
      ctx.arc(displayPt.x, displayPt.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalCompositeOperation = 'source-over';
    lastPointRef.current = { x, y };
  }, [brushMode, overlayColor, brushSize, toDisplaySpace, hexToRgba]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (mode === 'dot') {
      onCanvasClick?.(coords.x, coords.y);
      return;
    }

    if (mode === 'brush') {
      setIsDrawing(true);
      lastPointRef.current = null; // Reset for new stroke
      onBrushStrokeStart?.();
      onBrushStrokePoint?.(coords.x, coords.y);
      draw(coords.x, coords.y);
    }
  }, [mode, getCanvasCoords, onCanvasClick, onBrushStrokeStart, onBrushStrokePoint, draw]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mode !== 'brush' || !isDrawing) return;

    const coords = getCanvasCoords(e);
    if (!coords) return;

    onBrushStrokePoint?.(coords.x, coords.y);
    draw(coords.x, coords.y);
  }, [mode, isDrawing, getCanvasCoords, onBrushStrokePoint, draw]);

  const finishStroke = useCallback(() => {
    if (mode === 'brush' && isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null; // Reset for next stroke
      onBrushStrokeEnd?.();

      // Export canvas data
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        onCanvasChange?.(overlay.toDataURL());
      }
    }
  }, [mode, isDrawing, onBrushStrokeEnd, onCanvasChange]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (mode === 'dot') {
      onCanvasClick?.(coords.x, coords.y);
      return;
    }

    if (mode === 'brush') {
      setIsDrawing(true);
      onBrushStrokeStart?.();
      onBrushStrokePoint?.(coords.x, coords.y);
      draw(coords.x, coords.y);
    }
  }, [mode, getCanvasCoords, onCanvasClick, onBrushStrokeStart, onBrushStrokePoint, draw]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (mode !== 'brush' || !isDrawing) return;

    const coords = getCanvasCoords(e);
    if (!coords) return;

    onBrushStrokePoint?.(coords.x, coords.y);
    draw(coords.x, coords.y);
  }, [mode, isDrawing, getCanvasCoords, onBrushStrokePoint, draw]);

  return (
    <div ref={containerRef} className="relative inline-block cursor-crosshair rounded-lg overflow-hidden">
      <canvas ref={canvasRef} className="block" />
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0 block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishStroke}
        onMouseLeave={finishStroke}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={finishStroke}
      />
    </div>
  );
}
