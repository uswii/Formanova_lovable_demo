import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface CinematicHeroProps {
  images: { src: string; alt: string }[];
  className?: string;
}

export function CinematicHero({ images, className }: CinematicHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);

  // Scroll-based image transition
  useEffect(() => {
    let accumulatedDelta = 0;
    const scrollThreshold = 150;
    
    const handleWheel = (e: WheelEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const isInView = rect.top <= 0 && rect.bottom >= window.innerHeight * 0.5;
      
      if (!isInView) return;
      
      const now = Date.now();
      if (now - lastScrollTime.current < 100) return;
      
      accumulatedDelta += e.deltaY;
      
      if (Math.abs(accumulatedDelta) > scrollThreshold && !isTransitioning) {
        setIsTransitioning(true);
        
        if (accumulatedDelta > 0) {
          // Scroll down - next image
          setCurrentIndex(prev => (prev + 1) % images.length);
        } else {
          // Scroll up - previous image
          setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
        }
        
        accumulatedDelta = 0;
        lastScrollTime.current = now;
        
        setTimeout(() => setIsTransitioning(false), 800);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [images.length, isTransitioning]);

  // Track scroll for parallax effects
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / (rect.height - window.innerHeight)));
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-advance when not actively scrolling
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastScrollTime.current > 5000) {
        setCurrentIndex(prev => (prev + 1) % images.length);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div 
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      style={{ perspective: '1500px' }}
    >
      {images.map((image, index) => {
        const isActive = index === currentIndex;
        const isPrev = index === (currentIndex - 1 + images.length) % images.length;
        const isNext = index === (currentIndex + 1) % images.length;
        
        // 3D transforms based on position
        let transform = 'translateZ(-1000px) scale(0.5)';
        let opacity = 0;
        let zIndex = 0;
        
        if (isActive) {
          const parallaxY = scrollProgress * 100;
          const scale = 1 - scrollProgress * 0.1;
          transform = `translateY(${parallaxY}px) translateZ(0) scale(${scale}) rotateX(${scrollProgress * 5}deg)`;
          opacity = 1 - scrollProgress * 0.3;
          zIndex = 10;
        } else if (isPrev) {
          transform = 'translateX(-100%) translateZ(-200px) rotateY(25deg) scale(0.8)';
          opacity = 0.3;
          zIndex = 5;
        } else if (isNext) {
          transform = 'translateX(100%) translateZ(-200px) rotateY(-25deg) scale(0.8)';
          opacity = 0.3;
          zIndex = 5;
        }
        
        return (
          <div
            key={index}
            className="absolute inset-0 flex items-center justify-center transition-all duration-[1200ms] ease-out"
            style={{
              transform,
              opacity,
              zIndex,
              transformStyle: 'preserve-3d',
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center p-8 md:p-16 lg:p-24">
              <img 
                src={image.src} 
                alt={image.alt} 
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        );
      })}
      
      {/* Cinematic vignette - theme-neutral */}
      <div 
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.4) 100%)`,
        }}
      />
      
      {/* Progress indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-3">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={cn(
              'h-[2px] transition-all duration-500',
              index === currentIndex 
                ? 'w-12 bg-foreground' 
                : 'w-6 bg-foreground/30 hover:bg-foreground/50'
            )}
            aria-label={`View image ${index + 1}`}
          />
        ))}
      </div>
      
      {/* Scroll hint */}
      <div 
        className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 transition-opacity duration-500"
        style={{ opacity: scrollProgress > 0.2 ? 0 : 1 }}
      >
        <span className="text-xs uppercase tracking-[0.3em] text-foreground/50">Scroll to explore</span>
        <div className="w-6 h-10 border border-foreground/30 rounded-full flex justify-center pt-2">
          <div className="w-1 h-2 bg-foreground/50 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}
