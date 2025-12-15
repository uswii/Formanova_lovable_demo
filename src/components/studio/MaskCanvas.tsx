import React, { useRef, useEffect, useState, useCallback } from 'react';

interface Props {
  image: string;
  dots?: { x: number; y: number }[];
  brushColor?: string;
  brushSize?: number;
  mode: 'dot' | 'brush';
  onCanvasClick?: (x: number, y: number) => void;
  onCanvasChange?: (dataUrl: string) => void;
}

export function MaskCanvas({
  image,
  dots = [],
  brushColor = '#FF0000',
  brushSize = 10,
  mode,
  onCanvasClick,
  onCanvasChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Load and draw image
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

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
      
      ctx.drawImage(img, 0, 0, containerWidth, height);
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = image;
  }, [image]);

  // Draw dots for marking mode
  useEffect(() => {
    if (mode !== 'dot' || !imageLoaded) return;
    
    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    // Clear overlay
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    // Draw dots
    dots.forEach(dot => {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = brushColor;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [dots, brushColor, brushSize, mode, imageLoaded]);

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
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (mode === 'dot') {
      onCanvasClick?.(coords.x, coords.y);
    } else if (mode === 'brush') {
      setIsDrawing(true);
      draw(coords.x, coords.y);
    }
  }, [mode, getCanvasCoords, onCanvasClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mode !== 'brush' || !isDrawing) return;
    
    const coords = getCanvasCoords(e);
    if (coords) {
      draw(coords.x, coords.y);
    }
  }, [mode, isDrawing, getCanvasCoords]);

  const handleMouseUp = useCallback(() => {
    if (mode === 'brush' && isDrawing) {
      setIsDrawing(false);
      // Export canvas data
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        onCanvasChange?.(overlay.toDataURL());
      }
    }
  }, [mode, isDrawing, onCanvasChange]);

  const draw = useCallback((x: number, y: number) => {
    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = brushColor;
    ctx.fill();
  }, [brushColor, brushSize]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (mode === 'dot') {
      onCanvasClick?.(coords.x, coords.y);
    } else if (mode === 'brush') {
      setIsDrawing(true);
      draw(coords.x, coords.y);
    }
  }, [mode, getCanvasCoords, onCanvasClick, draw]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (mode !== 'brush' || !isDrawing) return;
    
    const coords = getCanvasCoords(e);
    if (coords) {
      draw(coords.x, coords.y);
    }
  }, [mode, isDrawing, getCanvasCoords, draw]);

  return (
    <div ref={containerRef} className="relative w-full cursor-crosshair">
      <canvas
        ref={canvasRef}
        className="w-full h-auto block"
      />
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0 w-full h-auto"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      />
    </div>
  );
}
