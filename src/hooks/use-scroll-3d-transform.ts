import { useEffect, useState, useRef, RefObject } from 'react';

interface Scroll3DTransformOptions {
  radius?: number;
  spacing?: number;
  perspective?: number;
}

interface TransformValues {
  translateZ: number;
  translateY: number;
  rotateX: number;
  opacity: number;
  scale: number;
}

export function useScroll3DTransform(
  containerRef: RefObject<HTMLElement>,
  itemCount: number,
  options: Scroll3DTransformOptions = {}
) {
  const { radius = 400, spacing = 25, perspective = 1500 } = options;
  const [transforms, setTransforms] = useState<TransformValues[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const calculateTransforms = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Calculate scroll progress (0 to 1) based on element position
      const elementTop = rect.top;
      const elementHeight = rect.height;
      
      // Start animation when element enters viewport, end when it leaves
      const startTrigger = viewportHeight;
      const endTrigger = -elementHeight;
      
      let progress = (startTrigger - elementTop) / (startTrigger - endTrigger);
      progress = Math.max(0, Math.min(1, progress));
      
      setScrollProgress(progress);

      // Calculate transforms for each item
      const newTransforms: TransformValues[] = [];
      
      for (let i = 0; i < itemCount; i++) {
        // Each item rotates based on scroll + its index position
        const baseAngle = (i * spacing);
        const scrollAngle = progress * 180; // Total rotation during scroll
        const angle = ((baseAngle - scrollAngle) * Math.PI) / 180;
        
        const y = Math.sin(angle) * radius * 0.3;
        const z = Math.cos(angle) * radius;
        const rotationAngle = baseAngle - scrollAngle;
        
        // Calculate opacity based on z position (front = visible, back = hidden)
        const normalizedZ = (z + radius) / (radius * 2);
        const opacity = Math.max(0, Math.min(1, normalizedZ * 1.5 - 0.25));
        
        // Scale based on z position
        const scale = 0.7 + (normalizedZ * 0.3);
        
        newTransforms.push({
          translateZ: z,
          translateY: y,
          rotateX: -rotationAngle,
          opacity,
          scale
        });
      }
      
      setTransforms(newTransforms);
    };

    calculateTransforms();
    
    window.addEventListener('scroll', calculateTransforms, { passive: true });
    window.addEventListener('resize', calculateTransforms);
    
    return () => {
      window.removeEventListener('scroll', calculateTransforms);
      window.removeEventListener('resize', calculateTransforms);
    };
  }, [containerRef, itemCount, radius, spacing]);

  return { transforms, scrollProgress, perspective };
}
