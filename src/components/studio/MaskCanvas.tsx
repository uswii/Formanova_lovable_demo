import React, { useRef, useEffect, useState, useCallback } from 'react';

interface Props {
  image: string;
  dots?: { x: number; y: number }[];
  brushColor?: string;
  brushSize?: number;
  mode: 'dot' | 'brush';
  /**
   * When "image": callbacks + dot coords are in the underlying image pixel space (naturalWidth/naturalHeight).
   * When "canvas": callbacks + dot coords are in the rendered canvas pixel space.
   */
  coordinateSpace?: 'image' | 'canvas';
  /**
   * Fixed canvas display size in pixels. Image will be scaled to fit within this size while maintaining aspect ratio.
   */
  canvasSize?: number;
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
  coordinateSpace = 'canvas',
  canvasSize = 400,
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
  const imageRef = useRef<HTMLImageElement | null>(null);

  const getNaturalSize = () => {
    const img = imageRef.current;
    return img ? { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height } : null;
  };

  // Load and draw image
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setImageLoaded(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Calculate display size to fit within canvasSize while maintaining aspect ratio
      const aspectRatio = img.width / img.height;
      let displayWidth: number;
      let displayHeight: number;

      if (aspectRatio > 1) {
        // Landscape: width is the limiting factor
        displayWidth = canvasSize;
        displayHeight = canvasSize / aspectRatio;
      } else {
        // Portrait or square: height is the limiting factor
        displayHeight = canvasSize;
        displayWidth = canvasSize * aspectRatio;
      }

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
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = image;
  }, [image, canvasSize]);

  const toImageSpace = useCallback((xDisplay: number, yDisplay: number) => {
    const overlay = overlayCanvasRef.current;
    const nat = getNaturalSize();
    if (!overlay || !nat) return { x: xDisplay, y: yDisplay };
    // Use display size (from style), not canvas buffer size
    const displayWidth = parseFloat(overlay.style.width) || overlay.width;
    const displayHeight = parseFloat(overlay.style.height) || overlay.height;
    return {
      x: (xDisplay / displayWidth) * nat.w,
      y: (yDisplay / displayHeight) * nat.h,
    };
  }, []);

  const toCanvasSpace = useCallback((xImage: number, yImage: number) => {
    const overlay = overlayCanvasRef.current;
    const nat = getNaturalSize();
    if (!overlay || !nat) return { x: xImage, y: yImage };
    // Use display size (from style), not canvas buffer size
    const displayWidth = parseFloat(overlay.style.width) || overlay.width;
    const displayHeight = parseFloat(overlay.style.height) || overlay.height;
    return {
      x: (xImage / nat.w) * displayWidth,
      y: (yImage / nat.h) * displayHeight,
    };
  }, []);

  // Draw dots for marking mode
  useEffect(() => {
    if (mode !== 'dot' || !imageLoaded) return;

    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = parseFloat(overlay.style.width) || overlay.width / dpr;
    const displayHeight = parseFloat(overlay.style.height) || overlay.height / dpr;

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.scale(dpr, dpr);

    // Draw dots
    dots.forEach((dot) => {
      const canvasPt = coordinateSpace === 'image' ? toCanvasSpace(dot.x, dot.y) : { x: dot.x, y: dot.y };
      ctx.beginPath();
      ctx.arc(canvasPt.x, canvasPt.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = brushColor;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [dots, brushColor, brushSize, mode, imageLoaded, coordinateSpace, toCanvasSpace]);

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

    // Use display coordinates (CSS size), not buffer size
    const xDisplay = clientX - rect.left;
    const yDisplay = clientY - rect.top;

    if (coordinateSpace === 'image') {
      return toImageSpace(xDisplay, yDisplay);
    }

    return { x: xDisplay, y: yDisplay };
  }, [coordinateSpace, toImageSpace]);

  const draw = useCallback((x: number, y: number) => {
    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasPt = coordinateSpace === 'image' ? toCanvasSpace(x, y) : { x, y };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.beginPath();
    ctx.arc(canvasPt.x, canvasPt.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = brushColor;
    ctx.fill();
  }, [brushColor, brushSize, coordinateSpace, toCanvasSpace]);

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
    <div ref={containerRef} className="relative flex items-center justify-center cursor-crosshair" style={{ minHeight: canvasSize }}>
      <div className="relative inline-block">
        <canvas ref={canvasRef} className="block" />
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={finishStroke}
          onMouseLeave={finishStroke}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={finishStroke}
        />
      </div>
    </div>
  );
}
