import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

// NOTE: We no longer hardcode SAM dimensions here.
// The backend handles all coordinate transformations via remap_click_points.
// We output points in ORIGINAL IMAGE coordinates, and the backend scales them.

interface BrushStroke {
  type: 'add' | 'remove';
  points: number[][];
  radius: number;
}

interface Props {
  image: string;
  dots?: { x: number; y: number }[];
  brushColor?: string;
  brushSize?: number;
  mode: 'dot' | 'brush';
  /**
   * Maximum canvas display size in pixels.
   */
  canvasSize?: number;
  /**
   * Jewelry type (used for display aspect ratio hints, not coordinate scaling)
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
  brushColor = '#FF0000',
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
  
  // Store original image dimensions for coordinate transformation
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);
  
  // Compute display dimensions based on canvas size and aspect ratio
  // Use 3:4 aspect for consistent display
  const displayWidth = canvasSize * (3 / 4);
  const displayHeight = canvasSize;

  // Load and draw image - stretched to 3:4 to match backend resize
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
      
      // Use device pixel ratio for sharper rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = displayWidth * dpr;
        overlayCanvasRef.current.height = displayHeight * dpr;
        overlayCanvasRef.current.style.width = `${displayWidth}px`;
        overlayCanvasRef.current.style.height = `${displayHeight}px`;
      }

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      
      // Draw image stretched to display dimensions
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      
      setImageLoaded(true);
      console.log('[MaskCanvas] Image drawn to canvas');
    };
    img.onerror = (e) => {
      console.error('[MaskCanvas] Failed to load image:', e);
    };
    img.src = image;
  }, [image, displayWidth, displayHeight]);

  // Transform display coordinates to original image space
  // Backend's remap_click_points expects points in original image coordinates
  const toOriginalSpace = useCallback((xDisplay: number, yDisplay: number) => {
    if (displayWidth === 0 || displayHeight === 0 || originalWidth === 0 || originalHeight === 0) {
      return { x: xDisplay, y: yDisplay };
    }
    const origX = (xDisplay / displayWidth) * originalWidth;
    const origY = (yDisplay / displayHeight) * originalHeight;
    console.log('toOriginalSpace:', { xDisplay, yDisplay, displayWidth, displayHeight, origX, origY, originalWidth, originalHeight });
    return { x: origX, y: origY };
  }, [displayWidth, displayHeight, originalWidth, originalHeight]);

  // Transform original image coordinates back to display space (for rendering dots/strokes)
  const toDisplaySpace = useCallback((xOrig: number, yOrig: number) => {
    if (originalWidth === 0 || originalHeight === 0) {
      return { x: xOrig, y: yOrig };
    }
    return {
      x: (xOrig / originalWidth) * displayWidth,
      y: (yOrig / originalHeight) * displayHeight,
    };
  }, [displayWidth, displayHeight, originalWidth, originalHeight]);

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
    const drawSmoothStroke = (points: number[][], radius: number, color: string) => {
      if (points.length === 0) return;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = radius;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (points.length === 1) {
        // Single point - draw a dot
        const displayPt = toDisplaySpace(points[0][0], points[0][1]);
        ctx.beginPath();
        ctx.arc(displayPt.x, displayPt.y, radius / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
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
    };

    // Always use consistent colors for strokes based on their type - NOT current brush
    const addColor = 'rgba(0, 255, 0, 0.35)';  // Green for add
    const removeColor = 'rgba(0, 0, 0, 0.35)'; // Black for remove
    
    // Draw all initial strokes as smooth lines - use stroke's own type for color
    initialStrokes.forEach((stroke) => {
      const color = stroke.type === 'add' ? addColor : removeColor;
      drawSmoothStroke(stroke.points, stroke.radius, color);
    });

    // Draw active stroke for live preview - use stroke's own type for color
    if (activeStroke && activeStroke.points.length > 0) {
      const color = activeStroke.type === 'add' ? addColor : removeColor;
      drawSmoothStroke(activeStroke.points, activeStroke.radius, color);
    }
  }, [imageLoaded, initialStrokes, activeStroke, mode, toDisplaySpace, brushColor]);

  // Draw dots for marking mode (dots are in SAM space)
  useEffect(() => {
    if (mode !== 'dot' || !imageLoaded) return;

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
      ctx.beginPath();
      ctx.arc(displayPt.x, displayPt.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#FF0000';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [dots, brushColor, brushSize, mode, imageLoaded, toDisplaySpace]);

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

    // Transform to original image coordinates (backend handles scaling)
    return toOriginalSpace(xDisplay, yDisplay);
  }, [toOriginalSpace]);

  // Store last point for smooth line drawing
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Draw a point or line segment on the canvas (x, y are in original image space)
  const draw = useCallback((x: number, y: number) => {
    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayPt = toDisplaySpace(x, y);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    // Use consistent colors based on brush type (green for add, black for remove)
    const drawColor = brushColor === '#00FF00' ? 'rgba(0, 255, 0, 0.35)' : 'rgba(0, 0, 0, 0.35)';
    
    if (lastPointRef.current) {
      // Draw line from last point to current point for smooth strokes
      const lastDisplayPt = toDisplaySpace(lastPointRef.current.x, lastPointRef.current.y);
      ctx.strokeStyle = drawColor;
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
      ctx.fillStyle = drawColor;
      ctx.fill();
    }
    
    lastPointRef.current = { x, y };
  }, [brushColor, brushSize, toDisplaySpace]);

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
