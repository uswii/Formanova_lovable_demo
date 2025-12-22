import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface HorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
}

export function HorizontalScroll({ children, className }: HorizontalScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const scrollContent = scrollRef.current;
    if (!container || !scrollContent) return;

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const containerHeight = container.offsetHeight;
      const windowHeight = window.innerHeight;
      
      // Calculate how far through the container we've scrolled
      const scrollStart = rect.top;
      const scrollEnd = rect.bottom - windowHeight;
      const totalScroll = containerHeight - windowHeight;
      
      if (scrollStart > 0) {
        setScrollProgress(0);
      } else if (scrollEnd < 0) {
        setScrollProgress(1);
      } else {
        const progress = -scrollStart / totalScroll;
        setScrollProgress(Math.max(0, Math.min(1, progress)));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={cn("relative h-[300vh]", className)}
    >
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <div 
          ref={scrollRef}
          className="flex gap-8 lg:gap-16 transition-transform duration-100 ease-out px-8"
          style={{
            transform: `translateX(${-scrollProgress * 66}%)`
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

interface HorizontalScrollItemProps {
  children: React.ReactNode;
  className?: string;
  index: number;
}

export function HorizontalScrollItem({ children, className, index }: HorizontalScrollItemProps) {
  return (
    <div 
      className={cn(
        "flex-shrink-0 w-[80vw] md:w-[50vw] lg:w-[33vw]",
        className
      )}
      style={{
        opacity: 1,
        transition: `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s`
      }}
    >
      {children}
    </div>
  );
}
