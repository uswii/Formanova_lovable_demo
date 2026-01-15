import React, { useRef, useEffect, useCallback, useState } from 'react';

// SAM dimensions based on jewelry type
// Necklaces use 2000x2667 (Flux pipeline), other jewelry uses 912x1168 (Gemini pipeline)
const NECKLACE_SAM_WIDTH = 2000;
const NECKLACE_SAM_HEIGHT = 2667;
const OTHER_SAM_WIDTH = 912;
const OTHER_SAM_HEIGHT = 1168;

interface BrushStroke {
  type: 'add' | 'remove';
  points: number[][];
  radius: number;
}

interface Props {
  maskImage: string;
  strokes: BrushStroke[];
  canvasSize?: number;
  jewelryType?: string;
}

export function BinaryMaskPreview({ maskImage, strokes, canvasSize = 400, jewelryType = 'necklace' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  
  // Compute SAM dimensions based on jewelry type
  const isNecklace = jewelryType === 'necklace' || jewelryType === 'necklaces';
  const SAM_WIDTH = isNecklace ? NECKLACE_SAM_WIDTH : OTHER_SAM_WIDTH;
  const SAM_HEIGHT = isNecklace ? NECKLACE_SAM_HEIGHT : OTHER_SAM_HEIGHT;
  
  // Aspect ratio matches the SAM dimensions for this jewelry type
  const displayWidth = canvasSize * (SAM_WIDTH / SAM_HEIGHT);
  const displayHeight = canvasSize;

  // Transform SAM coordinates to display space
  const toDisplaySpace = useCallback((xSam: number, ySam: number) => {
    return {
      x: (xSam / SAM_WIDTH) * displayWidth,
      y: (ySam / SAM_HEIGHT) * displayHeight,
    };
  }, [SAM_WIDTH, SAM_HEIGHT, displayWidth, displayHeight]);

  // Load image when maskImage changes
  useEffect(() => {
    if (!maskImage) {
      setLoadedImage(null);
      return;
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLoadedImage(img);
    };
    img.src = maskImage;
  }, [maskImage]);

  // Redraw canvas whenever strokes or loaded image changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    // Start with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Draw mask image if loaded (will be inverted later)
    if (loadedImage) {
      ctx.drawImage(loadedImage, 0, 0, displayWidth, displayHeight);
    }
    
    // Draw strokes as binary (black for add/jewelry, white for remove)
    const drawSmoothStroke = (points: number[][], radius: number, color: string) => {
      if (points.length === 0) return;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = radius;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (points.length === 1) {
        const displayPt = toDisplaySpace(points[0][0], points[0][1]);
        ctx.beginPath();
        ctx.arc(displayPt.x, displayPt.y, radius / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        return;
      }
      
      ctx.beginPath();
      const firstPt = toDisplaySpace(points[0][0], points[0][1]);
      ctx.moveTo(firstPt.x, firstPt.y);
      
      for (let i = 1; i < points.length; i++) {
        const pt = toDisplaySpace(points[i][0], points[i][1]);
        ctx.lineTo(pt.x, pt.y);
      }
      
      ctx.stroke();
    };

    // Draw strokes: add = black (jewelry), remove = white (background)
    strokes.forEach((stroke) => {
      const color = stroke.type === 'add' ? '#000000' : '#FFFFFF';
      drawSmoothStroke(stroke.points, stroke.radius, color);
    });

    // Post-process: invert mask and enforce strict binary (no anti-aliasing grays)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const threshold = 128;
    
    for (let i = 0; i < data.length; i += 4) {
      // Calculate grayscale value
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      // Threshold: dark pixels (jewelry) become white, light pixels (background) become black
      const binary = gray < threshold ? 255 : 0;
      data[i] = binary;     // R
      data[i + 1] = binary; // G
      data[i + 2] = binary; // B
      // Alpha stays as-is
    }
    
    ctx.putImageData(imageData, 0, 0);
  }, [loadedImage, strokes, displayWidth, displayHeight, toDisplaySpace]);

  return (
    <div className="relative inline-block pointer-events-none">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}