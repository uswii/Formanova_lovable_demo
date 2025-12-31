import React, { useRef, useEffect, useState, useCallback } from 'react';

// Fixed SAM dimensions - backend resizes all images to this exact size
const SAM_WIDTH = 2000;
const SAM_HEIGHT = 2667;

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
  
  // Fixed 3:4 aspect ratio to match SAM's 2000x2667 dimensions
  const displayWidth = canvasSize * (SAM_WIDTH / SAM_HEIGHT); // 3:4 ratio
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
      
      // Draw image stretched to 3:4 (same as backend resize to 2000x2667)
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      
      setImageLoaded(true);
      console.log('[MaskCanvas] Image drawn to canvas');
    };
    img.onerror = (e) => {
      console.error('[MaskCanvas] Failed to load image:', e);
    };
    img.src = image;
  }, [image, displayWidth, displayHeight]);

  // Transform display coordinates to SAM space (2000x2667)
  const toSamSpace = useCallback((xDisplay: number, yDisplay: number) => {
    if (displayWidth === 0 || displayHeight === 0) {
      return { x: xDisplay, y: yDisplay };
    }
    const samX = (xDisplay / displayWidth) * SAM_WIDTH;
    const samY = (yDisplay / displayHeight) * SAM_HEIGHT;
    console.log('toSamSpace:', { xDisplay, yDisplay, displayWidth, displayHeight, samX, samY });
    return { x: samX, y: samY };
  }, [displayWidth, displayHeight]);

  // Transform SAM coordinates back to display space (for rendering dots/strokes)
  const toDisplaySpace = useCallback((xSam: number, ySam: number) => {
    return {
      x: (xSam / SAM_WIDTH) * displayWidth,
      y: (ySam / SAM_HEIGHT) * displayHeight,
    };
  }, [displayWidth, displayHeight]);

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

    // Redraw all initial strokes (points are in SAM space, convert to display)
    // Use very low opacity for brush strokes
    const addColor = brushColor === '#FFFFFF' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 255, 0, 0.2)';
    const removeColor = 'rgba(0, 0, 0, 0.3)';
    
    initialStrokes.forEach((stroke) => {
      const color = stroke.type === 'add' ? addColor : removeColor;
      stroke.points.forEach((point) => {
        const displayPt = toDisplaySpace(point[0], point[1]);
        ctx.beginPath();
        ctx.arc(displayPt.x, displayPt.y, stroke.radius / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    });

    // Draw active stroke for live preview
    if (activeStroke && activeStroke.points.length > 0) {
      const color = activeStroke.type === 'add' ? addColor : removeColor;
      activeStroke.points.forEach((point) => {
        const displayPt = toDisplaySpace(point[0], point[1]);
        ctx.beginPath();
        ctx.arc(displayPt.x, displayPt.y, activeStroke.radius / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    }
  }, [imageLoaded, initialStrokes, activeStroke, mode, toDisplaySpace]);

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

    // Transform directly to SAM space (2000x2667)
    return toSamSpace(xDisplay, yDisplay);
  }, [toSamSpace]);

  // Draw a point on the canvas (x, y are in SAM space)
  const draw = useCallback((x: number, y: number) => {
    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayPt = toDisplaySpace(x, y);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.beginPath();
    ctx.arc(displayPt.x, displayPt.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = brushColor;
    ctx.fill();
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
