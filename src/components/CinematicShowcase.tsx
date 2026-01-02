import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import images
import mannequinInput from '@/assets/showcase/mannequin-input.png';
import jewelryOverlay from '@/assets/showcase/mannequin-jewelry-overlay.png';
import modelBlackDress from '@/assets/showcase/model-black-dress.png';
import modelWhiteDress from '@/assets/showcase/model-white-dress.png';
import modelBlackTank from '@/assets/showcase/model-black-tank.png';
import metrics1 from '@/assets/showcase/metrics-1.png';
import metrics2 from '@/assets/showcase/metrics-2.png';
import metrics3 from '@/assets/showcase/metrics-3.png';

type Section = 'A' | 'B' | 'C';

const generatedImages = [modelBlackDress, modelWhiteDress, modelBlackTank];
const metricsImages = [metrics1, metrics2, metrics3];

// Section durations in ms
const SECTION_A_DURATION = 8000; // 8 seconds for toggle effect
const SECTION_B_DURATION = 4000; // 4 seconds for metrics
const SECTION_C_DURATION = 4000; // 4 seconds for final

export function CinematicShowcase() {
  const [section, setSection] = useState<Section>('A');
  const [toggleIndex, setToggleIndex] = useState(0); // 0 = input, 1-3 = generated images
  const [metricsIndex, setMetricsIndex] = useState(0);

  // Section A: Rapid toggle between input and generated images
  useEffect(() => {
    if (section !== 'A') return;

    const toggleInterval = setInterval(() => {
      setToggleIndex(prev => (prev + 1) % 4); // 0, 1, 2, 3, 0, 1...
    }, 600); // Fast toggle every 600ms

    const sectionTimer = setTimeout(() => {
      setSection('B');
    }, SECTION_A_DURATION);

    return () => {
      clearInterval(toggleInterval);
      clearTimeout(sectionTimer);
    };
  }, [section]);

  // Section B: Cycle through metrics
  useEffect(() => {
    if (section !== 'B') return;

    const metricsInterval = setInterval(() => {
      setMetricsIndex(prev => (prev + 1) % metricsImages.length);
    }, 1200);

    const sectionTimer = setTimeout(() => {
      setSection('C');
    }, SECTION_B_DURATION);

    return () => {
      clearInterval(metricsInterval);
      clearTimeout(sectionTimer);
    };
  }, [section]);

  // Section C: Hold final image, then restart
  useEffect(() => {
    if (section !== 'C') return;

    const sectionTimer = setTimeout(() => {
      setSection('A');
      setToggleIndex(0);
      setMetricsIndex(0);
    }, SECTION_C_DURATION);

    return () => clearTimeout(sectionTimer);
  }, [section]);

  // Get current image for Section A
  const getSectionAImage = () => {
    if (toggleIndex === 0) {
      return jewelryOverlay; // Input with jewelry overlay
    }
    return generatedImages[toggleIndex - 1];
  };

  return (
    <div className="w-full">
      <div className="relative aspect-[3/4] max-w-2xl mx-auto rounded-2xl overflow-hidden bg-black/5">
        <AnimatePresence mode="wait">
          {/* SECTION A — Toggle Effect */}
          {section === 'A' && (
            <motion.div
              key="section-a"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={toggleIndex}
                  src={getSectionAImage()}
                  alt={toggleIndex === 0 ? "Input with jewelry overlay" : "Generated output"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-full h-full object-contain"
                />
              </AnimatePresence>
              
              {/* Label indicator */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                <motion.div
                  key={toggleIndex === 0 ? 'input' : 'output'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm"
                >
                  <span className="text-white text-sm font-medium">
                    {toggleIndex === 0 ? 'INPUT' : 'OUTPUT'}
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* SECTION B — Metrics Only */}
          {section === 'B' && (
            <motion.div
              key="section-b"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center bg-background/95"
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={metricsIndex}
                  src={metricsImages[metricsIndex]}
                  alt="Quality metrics"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-[90%] max-h-[90%] object-contain rounded-lg shadow-2xl"
                />
              </AnimatePresence>
              
              {/* Verification label */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2">
                <div className="px-4 py-2 rounded-full bg-primary/90 backdrop-blur-sm">
                  <span className="text-primary-foreground text-sm font-medium">
                    VERIFIED ACCURACY
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* SECTION C — Clean Final Output */}
          {section === 'C' && (
            <motion.div
              key="section-c"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <motion.img
                src={modelBlackDress}
                alt="Final photorealistic result"
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="w-full h-full object-contain"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
          {(['A', 'B', 'C'] as Section[]).map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                section === s 
                  ? 'bg-primary w-6' 
                  : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
