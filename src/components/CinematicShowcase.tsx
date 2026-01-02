import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import showcase images
import mannequinInput from '@/assets/showcase/mannequin-input.png';
import modelBlackDress from '@/assets/showcase/model-black-dress.png';
import modelWhiteDress from '@/assets/showcase/model-white-dress.png';
import modelBlackTank from '@/assets/showcase/model-black-tank.png';
import metrics1 from '@/assets/showcase/metrics-1.png';
import metrics2 from '@/assets/showcase/metrics-2.png';
import metrics3 from '@/assets/showcase/metrics-3.png';

interface ModelData {
  image: string;
  label: string;
  metrics: string;
  precision: string;
  recall: string;
  iou: string;
}

const models: ModelData[] = [
  { 
    image: modelBlackDress, 
    label: 'Black Strap Dress', 
    metrics: metrics1,
    precision: '99.9%',
    recall: '93.9%',
    iou: '93.8%'
  },
  { 
    image: modelWhiteDress, 
    label: 'White V-Neck', 
    metrics: metrics2,
    precision: '99.7%',
    recall: '94.1%',
    iou: '93.9%'
  },
  { 
    image: modelBlackTank, 
    label: 'Black Tank Top', 
    metrics: metrics3,
    precision: '99.9%',
    recall: '94.1%',
    iou: '94.0%'
  },
];

// Section durations in milliseconds
const SECTION_1_DURATION = 8000; // Zero Alterations - input → output transitions
const SECTION_2_DURATION = 9000; // Verified Accuracy - with metrics
const SECTION_3_DURATION = 9000; // Realistic Imagery - clean outputs

type Section = 'zero-alterations' | 'verified-accuracy' | 'realistic-imagery';

export function CinematicShowcase() {
  const [currentSection, setCurrentSection] = useState<Section>('zero-alterations');
  const [showingOutput, setShowingOutput] = useState(false);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const [jewelryHighlight, setJewelryHighlight] = useState(false);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Main timeline controller
  useEffect(() => {
    let sectionTimer: NodeJS.Timeout;
    let subTimer1: NodeJS.Timeout;
    let subTimer2: NodeJS.Timeout;
    let subTimer3: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;
    
    const runSection = (section: Section) => {
      setCurrentSection(section);
      
      if (section === 'zero-alterations') {
        // Section 1: Show input, then transition to output with jewelry emphasis
        setShowingOutput(false);
        setJewelryHighlight(false);
        setCurrentModelIndex(0);
        
        // After 2s, start jewelry highlight
        subTimer1 = setTimeout(() => setJewelryHighlight(true), 2000);
        // After 4s, show first output
        subTimer2 = setTimeout(() => {
          setShowingOutput(true);
          setJewelryHighlight(true);
        }, 4000);
        // After 6s, remove highlight, keep output
        subTimer3 = setTimeout(() => setJewelryHighlight(false), 6000);
        
        // Move to section 2
        sectionTimer = setTimeout(() => runSection('verified-accuracy'), SECTION_1_DURATION);
        
      } else if (section === 'verified-accuracy') {
        // Section 2: Cycle through outputs with metrics
        setShowingOutput(true);
        setJewelryHighlight(false);
        
        // Cycle through 3 models (3s each)
        const cycleModels = (index: number) => {
          if (index < 3) {
            setCurrentModelIndex(index);
            subTimer1 = setTimeout(() => cycleModels(index + 1), 3000);
          }
        };
        cycleModels(0);
        
        // Move to section 3
        sectionTimer = setTimeout(() => runSection('realistic-imagery'), SECTION_2_DURATION);
        
      } else if (section === 'realistic-imagery') {
        // Section 3: Clean outputs cycling with elegant transitions
        setShowingOutput(true);
        setJewelryHighlight(false);
        
        // Cycle through models with longer transitions
        const cycleModels = (index: number) => {
          if (index < 3) {
            setCurrentModelIndex(index);
            subTimer1 = setTimeout(() => cycleModels(index + 1), 3000);
          }
        };
        cycleModels(0);
        
        // Loop back to section 1
        sectionTimer = setTimeout(() => runSection('zero-alterations'), SECTION_3_DURATION);
      }
    };
    
    // Start progress bar
    const totalDuration = SECTION_1_DURATION + SECTION_2_DURATION + SECTION_3_DURATION;
    const startTime = Date.now();
    progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) % totalDuration;
      setProgress((elapsed / totalDuration) * 100);
    }, 50);
    
    runSection('zero-alterations');
    
    return () => {
      clearTimeout(sectionTimer);
      clearTimeout(subTimer1);
      clearTimeout(subTimer2);
      clearTimeout(subTimer3);
      clearInterval(progressInterval);
    };
  }, []);
  
  const getSectionLabel = () => {
    switch (currentSection) {
      case 'zero-alterations': return 'Zero Alterations';
      case 'verified-accuracy': return 'Verified Accuracy';
      case 'realistic-imagery': return 'Realistic Imagery';
    }
  };
  
  const getSectionIndex = () => {
    switch (currentSection) {
      case 'zero-alterations': return 0;
      case 'verified-accuracy': return 1;
      case 'realistic-imagery': return 2;
    }
  };

  return (
    <div ref={containerRef} className="w-full relative">
      {/* Section indicator pills */}
      <div className="flex items-center justify-center gap-3 mb-8">
        {['Zero Alterations', 'Verified Accuracy', 'Realistic Imagery'].map((label, index) => (
          <div
            key={label}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-500 ${
              getSectionIndex() === index
                ? 'bg-primary text-primary-foreground scale-105'
                : 'bg-muted/30 text-muted-foreground'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      
      {/* Main video container */}
      <div className="relative aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden bg-black/5">
        
        {/* SECTION 1 & 2: Split view - Input | Output */}
        {(currentSection === 'zero-alterations' || currentSection === 'verified-accuracy') && (
          <div className="absolute inset-0 flex">
            {/* Left side - Input */}
            <div className="w-1/2 relative overflow-hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0"
              >
                <img 
                  src={mannequinInput} 
                  alt="Input jewelry" 
                  className="w-full h-full object-cover object-top"
                />
                
                {/* Jewelry highlight overlay - subtle glow effect */}
                <AnimatePresence>
                  {jewelryHighlight && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'radial-gradient(ellipse 30% 15% at 50% 20%, rgba(212, 175, 55, 0.3) 0%, transparent 70%)',
                      }}
                    />
                  )}
                </AnimatePresence>
                
                {/* Input label */}
                <div className="absolute bottom-4 left-4">
                  <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm">
                    Input
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Center divider with arrow */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <motion.div
                animate={{ x: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="bg-primary rounded-full p-3 shadow-lg"
              >
                <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.div>
            </div>
            
            {/* Right side - Output */}
            <div className="w-1/2 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {showingOutput ? (
                  <motion.div
                    key={`output-${currentModelIndex}`}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0"
                  >
                    <img 
                      src={models[currentModelIndex].image} 
                      alt="Output" 
                      className="w-full h-full object-cover object-top"
                    />
                    
                    {/* Jewelry highlight overlay on output - matches input */}
                    <AnimatePresence>
                      {jewelryHighlight && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.8 }}
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: 'radial-gradient(ellipse 25% 12% at 50% 18%, rgba(212, 175, 55, 0.35) 0%, transparent 70%)',
                          }}
                        />
                      )}
                    </AnimatePresence>
                    
                    {/* Output label */}
                    <div className="absolute bottom-4 left-4">
                      <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm">
                        Output
                      </div>
                    </div>
                    
                    {/* Jewelry preserved badge - Section 1 only */}
                    {currentSection === 'zero-alterations' && showingOutput && !jewelryHighlight && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-4 right-4"
                      >
                        <div className="bg-green-500/90 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Jewelry Unchanged
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.3 }}
                    className="absolute inset-0 bg-muted flex items-center justify-center"
                  >
                    <div className="text-muted-foreground">Generating...</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
        
        {/* SECTION 2: Metrics overlay */}
        {currentSection === 'verified-accuracy' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 pt-16"
          >
            <div className="flex items-center justify-center gap-8 md:gap-16">
              <motion.div 
                key={`precision-${currentModelIndex}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-5xl font-bold text-green-400 font-display">
                  {models[currentModelIndex].precision}
                </div>
                <div className="text-xs md:text-sm text-white/70 mt-1">Precision</div>
              </motion.div>
              
              <motion.div 
                key={`recall-${currentModelIndex}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-5xl font-bold text-green-400 font-display">
                  {models[currentModelIndex].recall}
                </div>
                <div className="text-xs md:text-sm text-white/70 mt-1">Recall</div>
              </motion.div>
              
              <motion.div 
                key={`iou-${currentModelIndex}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <div className="text-3xl md:text-5xl font-bold text-green-400 font-display">
                  {models[currentModelIndex].iou}
                </div>
                <div className="text-xs md:text-sm text-white/70 mt-1">IoU</div>
              </motion.div>
            </div>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center text-white/60 text-sm mt-4"
            >
              Mathematically verified accuracy • Not manually curated
            </motion.p>
          </motion.div>
        )}
        
        {/* SECTION 3: Full-screen clean outputs */}
        {currentSection === 'realistic-imagery' && (
          <div className="absolute inset-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={`final-${currentModelIndex}`}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 1 }}
                className="absolute inset-0"
              >
                <img 
                  src={models[currentModelIndex].image} 
                  alt={models[currentModelIndex].label}
                  className="w-full h-full object-cover object-top"
                />
                
                {/* Subtle vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10 pointer-events-none" />
                
                {/* Model label */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="absolute top-4 left-4"
                >
                  <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm">
                    {models[currentModelIndex].label}
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
        
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-40">
          <motion.div
            className="h-full bg-primary"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>
      
      {/* Section description */}
      <motion.div
        key={currentSection}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 text-center"
      >
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {currentSection === 'zero-alterations' && 
            'Watch as we transform the mannequin to a real model — the jewelry remains pixel-perfect, unchanged.'}
          {currentSection === 'verified-accuracy' && 
            'Every output is mathematically verified. These aren\'t cherry-picked — they\'re measured.'}
          {currentSection === 'realistic-imagery' && 
            'The final result: studio-quality imagery with your jewelry exactly as you designed it.'}
        </p>
      </motion.div>
    </div>
  );
}
