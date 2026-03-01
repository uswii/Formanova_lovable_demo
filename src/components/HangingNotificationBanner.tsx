import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const HangingNotificationBanner = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <div className="relative w-full flex justify-center pointer-events-none z-50">
          {/* Hanging strings */}
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute top-0 left-[20%] w-px h-4 bg-border origin-top"
          />
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute top-0 right-[20%] w-px h-4 bg-border origin-top"
          />

          {/* Banner */}
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 16, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 120,
              damping: 14,
              mass: 0.8,
            }}
            className="pointer-events-auto w-[calc(100%-2rem)] max-w-3xl mx-4"
          >
            {/* Subtle perpetual sway */}
            <motion.div
              animate={{
                rotate: [0, 0.3, 0, -0.3, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: 'top center' }}
              className="relative marta-frame bg-background/95 backdrop-blur-sm border border-border px-5 py-4 md:px-6 md:py-4"
            >
              {/* Close button */}
              <button
                onClick={() => setVisible(false)}
                className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="pr-6 text-center space-y-1.5">
                <p className="font-display text-sm md:text-base uppercase tracking-wider text-foreground">
                  We're currently updating our systems
                </p>
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                  We've successfully received your photos. Delivery may take 24–72 hours.
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground/70 font-mono tracking-wide">
                  Thank you for your patience — your results are on the way.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default HangingNotificationBanner;
