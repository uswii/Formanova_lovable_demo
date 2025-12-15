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
      // Set canvas dimensions to match image aspect ratio
      const containerWidth = containerRef.current?.clientWidth || 600;
      const aspectRatio = img.height / img.width;
      const height = containerWidth * aspectRatio;

      canvas.width = containerWidth;
      canvas.height = height;

      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = containerWidth;
        overlayCanvasRef.current.height = height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, containerWidth, height);
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = image;
  }, [image]);

  const toImageSpace = useCallback((xCanvas: number, yCanvas: number) => {
    const overlay = overlayCanvasRef.current;
    const nat = getNaturalSize();
    if (!overlay || !nat) return { x: xCanvas, y: yCanvas };
    return {
      x: (xCanvas / overlay.width) * nat.w,
      y: (yCanvas / overlay.height) * nat.h,
    };
  }, []);

  const toCanvasSpace = useCallback((xImage: number, yImage: number) => {
    const overlay = overlayCanvasRef.current;
    const nat = getNaturalSize();
    if (!overlay || !nat) return { x: xImage, y: yImage };
    return {
      x: (xImage / nat.w) * overlay.width,
      y: (yImage / nat.h) * overlay.height,
    };
  }, []);

  // Draw dots for marking mode
  useEffect(() => {
    if (mode !== 'dot' || !imageLoaded) return;

    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    // Clear overlay
    ctx.clearRect(0, 0, overlay.width, overlay.height);

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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const xCanvas = (clientX - rect.left) * scaleX;
    const yCanvas = (clientY - rect.top) * scaleY;

    if (coordinateSpace === 'image') {
      return toImageSpace(xCanvas, yCanvas);
    }

    return { x: xCanvas, y: yCanvas };
  }, [coordinateSpace, toImageSpace]);

  const draw = useCallback((x: number, y: number) => {
    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    const canvasPt = coordinateSpace === 'image' ? toCanvasSpace(x, y) : { x, y };

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
    <div ref={containerRef} className="relative w-full cursor-crosshair">
      <canvas ref={canvasRef} className="w-full h-auto block" />
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0 w-full h-auto"
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
