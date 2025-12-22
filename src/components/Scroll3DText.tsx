import React, { useRef } from 'react';
import { useScroll3DTransform } from '@/hooks/use-scroll-3d-transform';
import { cn } from '@/lib/utils';

interface Scroll3DTextProps {
  items: string[];
  className?: string;
  outlined?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
}

export function Scroll3DText({ 
  items, 
  className,
  outlined = true,
  gradientFrom = 'hsl(var(--primary))',
  gradientTo = 'hsl(var(--accent))'
}: Scroll3DTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { transforms, perspective } = useScroll3DTransform(
    containerRef, 
    items.length,
    { radius: 350, spacing: 30 }
  );

  return (
    <section 
      ref={containerRef}
      className={cn(
        "relative min-h-[200vh] flex items-center justify-center overflow-hidden",
        className
      )}
    >
      <div 
        className="sticky top-1/2 -translate-y-1/2 w-full flex flex-col items-center justify-center"
        style={{ perspective: `${perspective}px` }}
      >
        <div 
          className="relative w-full flex flex-col items-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {items.map((text, index) => {
            const transform = transforms[index] || {
              translateZ: 0,
              translateY: 0,
              rotateX: 0,
              opacity: 1,
              scale: 1
            };

            return (
              <div
                key={index}
                className="absolute w-full text-center transition-all duration-100 ease-out"
                style={{
                  transform: `
                    translateZ(${transform.translateZ}px) 
                    translateY(${transform.translateY}px) 
                    rotateX(${transform.rotateX}deg)
                    scale(${transform.scale})
                  `,
                  opacity: transform.opacity,
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                }}
              >
                <h2
                  className={cn(
                    "text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-display font-bold tracking-tight leading-none whitespace-nowrap",
                    outlined ? "text-outline" : ""
                  )}
                  style={outlined ? {
                    WebkitTextStroke: '2px currentColor',
                    WebkitTextFillColor: 'transparent',
                    color: 'hsl(var(--foreground))'
                  } : {
                    background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  {text}
                </h2>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
