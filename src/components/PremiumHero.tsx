import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface PremiumHeroProps {
  images: { src: string; alt: string }[];
  children: React.ReactNode;
  className?: string;
}

export function PremiumHero({ images, children, className }: PremiumHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const [parallaxY, setParallaxY] = useState(0);
  const [imageScale, setImageScale] = useState(1);
  const lastScrollTime = useRef(0);

  // Entrance animation on load
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Subtle parallax on scroll (0.6-0.8x speed)
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const scrollY = window.scrollY;
      const rect = containerRef.current.getBoundingClientRect();
      const containerTop = rect.top + scrollY;
      const containerHeight = rect.height;
      
      // Only apply parallax when hero is in view
      if (scrollY < containerTop + containerHeight) {
        // Slower scroll (0.7x speed creates subtle depth)
        const parallaxAmount = scrollY * 0.3;
        setParallaxY(parallaxAmount);
        
        // Micro scale-down on scroll (1 → 0.97)
        const scrollProgress = Math.min(scrollY / containerHeight, 1);
        const scale = 1 - (scrollProgress * 0.03);
        setImageScale(scale);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-advance images with cross-fade
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastScrollTime.current > 4000 && !isTransitioning) {
        setIsTransitioning(true);
        setCurrentIndex(prev => (prev + 1) % images.length);
        setTimeout(() => setIsTransitioning(false), 800);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [images.length, isTransitioning]);

  return (
    <section 
      ref={containerRef}
      className={cn('min-h-screen relative overflow-hidden bg-background', className)}
    >
      {/* Split Layout Container */}
      <div className="min-h-screen flex">
        
        {/* Left Side - Text Content (40-45%) */}
        <div className="w-full lg:w-[42%] relative z-20 flex items-center">
          <div className="w-full px-6 md:px-12 lg:px-16 xl:px-20 py-24 lg:py-0">
            {children}
          </div>
        </div>

        {/* Right Side - Hero Image (55-60%) */}
        <div className="hidden lg:block lg:w-[58%] absolute lg:relative right-0 top-0 h-full overflow-hidden">
          {/* Top gradient fade for navbar blend */}
          <div 
            className="absolute top-0 left-0 right-0 h-48 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, hsl(var(--background)) 0%, hsl(var(--background) / 0.6) 40%, transparent 100%)'
            }}
          />
          
          {/* Left edge gradient for smooth text blend */}
          <div 
            className="absolute top-0 left-0 bottom-0 w-32 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(to right, hsl(var(--background)) 0%, hsl(var(--background) / 0.4) 50%, transparent 100%)'
            }}
          />
          
          {/* Bottom gradient for smooth section transition */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-48 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.5) 40%, transparent 100%)'
            }}
          />

          {/* Image Container with parallax */}
          <div 
            ref={imageRef}
            className="absolute inset-0 -right-8"
            style={{
              transform: `translateY(${parallaxY}px) scale(${imageScale})`,
              transition: 'transform 0.1s linear',
            }}
          >
            {images.map((image, index) => {
              const isActive = index === currentIndex;
              const isPrev = index === (currentIndex - 1 + images.length) % images.length;
              
              return (
                <div
                  key={index}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive 
                      ? `translateY(0) scale(${isLoaded ? 1 : 1.07})` 
                      : isPrev 
                        ? 'translateY(-15px)' 
                        : 'translateY(15px)',
                    transition: isLoaded 
                      ? 'opacity 700ms ease-out, transform 700ms ease-out' 
                      : 'opacity 1100ms ease-out, transform 1100ms ease-out',
                    zIndex: isActive ? 2 : 1,
                  }}
                >
                  <img 
                    src={image.src} 
                    alt={image.alt}
                    className="w-full h-full object-cover object-center"
                    style={{
                      opacity: isLoaded ? 1 : 0,
                      transform: isLoaded ? 'scale(1)' : 'scale(1.07)',
                      transition: 'opacity 1100ms ease-out, transform 1100ms ease-out',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Subtle vignette for depth */}
          <div 
            className="absolute inset-0 pointer-events-none z-[5]"
            style={{
              background: 'radial-gradient(ellipse at 70% 50%, transparent 30%, hsl(var(--background) / 0.15) 100%)'
            }}
          />
        </div>

        {/* Mobile: Full background image */}
        <div className="lg:hidden absolute inset-0 z-0">
          {/* Overlay for text readability */}
          <div className="absolute inset-0 bg-background/80 z-10" />
          
          {images.map((image, index) => {
            const isActive = index === currentIndex;
            
            return (
              <div
                key={index}
                className="absolute inset-0"
                style={{
                  opacity: isActive ? 0.4 : 0,
                  transition: 'opacity 700ms ease-out',
                }}
              >
                <img 
                  src={image.src} 
                  alt={image.alt}
                  className="w-full h-full object-cover"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress indicators - positioned on image side */}
      <div className="hidden lg:flex absolute bottom-12 right-12 z-30 gap-2">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              if (!isTransitioning) {
                setIsTransitioning(true);
                setCurrentIndex(index);
                setTimeout(() => setIsTransitioning(false), 800);
              }
            }}
            className={cn(
              'h-[2px] transition-all duration-500',
              index === currentIndex 
                ? 'w-8 bg-foreground/70' 
                : 'w-4 bg-foreground/20 hover:bg-foreground/40'
            )}
            aria-label={`View image ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
