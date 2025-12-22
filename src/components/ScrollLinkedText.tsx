import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScrollLinkedTextProps {
  phrases: string[];
  className?: string;
  highlightClassName?: string;
}

export const ScrollLinkedText: React.FC<ScrollLinkedTextProps> = ({
  phrases,
  className,
  highlightClassName = 'hero-accent-text',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  });

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (value) => {
      const index = Math.min(
        Math.floor(value * phrases.length),
        phrases.length - 1
      );
      setActiveIndex(Math.max(0, index));
    });
    return () => unsubscribe();
  }, [scrollYProgress, phrases.length]);

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      style={{ height: `${phrases.length * 100}vh` }}
    >
      <div className="sticky top-1/2 -translate-y-1/2 flex items-center justify-center">
        <div className="text-center max-w-4xl mx-auto px-8">
          {phrases.map((phrase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: activeIndex === index ? 1 : 0,
                y: activeIndex === index ? 0 : activeIndex > index ? -20 : 20,
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={cn(
                'absolute inset-0 flex items-center justify-center',
                activeIndex === index ? 'pointer-events-auto' : 'pointer-events-none'
              )}
            >
              <h2 className={cn('marta-headline leading-tight', highlightClassName)}>
                {phrase}
              </h2>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Word-by-word reveal animation
interface ScrollRevealWordsProps {
  text: string;
  className?: string;
  highlightWords?: string[];
  highlightClassName?: string;
}

export const ScrollRevealWords: React.FC<ScrollRevealWordsProps> = ({
  text,
  className,
  highlightWords = [],
  highlightClassName = 'hero-accent-text',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const words = text.split(' ');
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.8', 'end 0.2'],
  });

  return (
    <div ref={containerRef} className={cn('py-24', className)}>
      <p className="marta-headline leading-tight max-w-5xl mx-auto text-center">
        {words.map((word, index) => {
          const start = index / words.length;
          const end = (index + 1) / words.length;
          const isHighlight = highlightWords.some(hw => 
            word.toLowerCase().includes(hw.toLowerCase())
          );
          
          return (
            <Word
              key={index}
              progress={scrollYProgress}
              range={[start, end]}
              className={isHighlight ? highlightClassName : ''}
            >
              {word}
            </Word>
          );
        })}
      </p>
    </div>
  );
};

interface WordProps {
  children: string;
  progress: any;
  range: [number, number];
  className?: string;
}

const Word: React.FC<WordProps> = ({ children, progress, range, className }) => {
  const opacity = useTransform(progress, range, [0.15, 1]);
  const y = useTransform(progress, range, [8, 0]);
  
  return (
    <motion.span
      style={{ opacity, y }}
      className={cn('inline-block mr-[0.25em] transition-colors duration-300', className)}
    >
      {children}
    </motion.span>
  );
};

// Narrative scroll sections
interface ScrollNarrativeProps {
  sections: {
    label?: string;
    title: string;
    description?: string;
  }[];
  className?: string;
}

export const ScrollNarrative: React.FC<ScrollNarrativeProps> = ({
  sections,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (value) => {
      const index = Math.min(
        Math.floor(value * sections.length),
        sections.length - 1
      );
      setActiveIndex(Math.max(0, index));
    });
    return () => unsubscribe();
  }, [scrollYProgress, sections.length]);

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      style={{ height: `${sections.length * 100}vh` }}
    >
      <div className="sticky top-0 h-screen flex items-center justify-center">
        <div className="marta-container text-center">
          {sections.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{
                opacity: activeIndex === index ? 1 : 0,
                scale: activeIndex === index ? 1 : 0.95,
              }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center px-8',
                activeIndex === index ? 'pointer-events-auto' : 'pointer-events-none'
              )}
            >
              {section.label && (
                <motion.span 
                  className="marta-label mb-8 block"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ 
                    opacity: activeIndex === index ? 1 : 0,
                    y: activeIndex === index ? 0 : 10 
                  }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  {section.label}
                </motion.span>
              )}
              <motion.h2 
                className="marta-headline hero-accent-text leading-tight max-w-4xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: activeIndex === index ? 1 : 0,
                  y: activeIndex === index ? 0 : 20 
                }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {section.title}
              </motion.h2>
              {section.description && (
                <motion.p 
                  className="marta-body text-muted-foreground max-w-lg mt-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: activeIndex === index ? 1 : 0,
                    y: activeIndex === index ? 0 : 20 
                  }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  {section.description}
                </motion.p>
              )}
            </motion.div>
          ))}
          
          {/* Progress indicators */}
          <div className="fixed right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-50">
            {sections.map((_, index) => (
              <motion.div
                key={index}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-300',
                  activeIndex === index 
                    ? 'bg-primary scale-125' 
                    : 'bg-foreground/20'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
