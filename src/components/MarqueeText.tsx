import React from 'react';
import { cn } from '@/lib/utils';

interface MarqueeTextProps {
  children: string;
  className?: string;
  speed?: 'slow' | 'normal' | 'fast';
  direction?: 'left' | 'right';
  pauseOnHover?: boolean;
}

export function MarqueeText({ 
  children, 
  className,
  speed = 'normal',
  direction = 'left',
  pauseOnHover = true
}: MarqueeTextProps) {
  const speedMap = {
    slow: '40s',
    normal: '25s',
    fast: '15s'
  };

  return (
    <div className={cn(
      "relative overflow-hidden w-full",
      pauseOnHover && "group",
      className
    )}>
      <div 
        className={cn(
          "flex whitespace-nowrap",
          pauseOnHover && "group-hover:[animation-play-state:paused]"
        )}
        style={{
          animation: `marquee ${speedMap[speed]} linear infinite`,
          animationDirection: direction === 'right' ? 'reverse' : 'normal'
        }}
      >
        {/* Repeat content for seamless loop */}
        {[...Array(4)].map((_, i) => (
          <span 
            key={i} 
            className="font-display text-[8vw] md:text-[6vw] lg:text-[5vw] uppercase tracking-tight px-8 text-foreground/10"
          >
            {children}
          </span>
        ))}
      </div>
    </div>
  );
}

// Divider marquee for section breaks
interface MarqueeDividerProps {
  words: string[];
  className?: string;
  speed?: 'slow' | 'normal' | 'fast';
}

export function MarqueeDivider({ 
  words, 
  className,
  speed = 'normal' 
}: MarqueeDividerProps) {
  const speedMap = {
    slow: '60s',
    normal: '40s',
    fast: '25s'
  };

  return (
    <div className={cn(
      "relative overflow-hidden w-full py-8 border-y border-border/10",
      className
    )}>
      <div 
        className="flex whitespace-nowrap items-center"
        style={{
          animation: `marquee ${speedMap[speed]} linear infinite`
        }}
      >
        {/* Repeat pattern for seamless loop */}
        {[...Array(6)].map((_, i) => (
          <React.Fragment key={i}>
            {words.map((word, j) => (
              <React.Fragment key={`${i}-${j}`}>
                <span className="font-display text-xl md:text-2xl uppercase tracking-widest text-foreground/60 px-6">
                  {word}
                </span>
                <span className="w-2 h-2 rounded-full bg-primary/60 mx-4" />
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
