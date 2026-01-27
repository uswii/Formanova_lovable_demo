import { motion } from 'framer-motion';
import { Clock, Sparkles } from 'lucide-react';

interface ProcessingTimeNoticeProps {
  imageCount: number;
  onAcknowledge?: () => void;
  acknowledged?: boolean;
}

const ProcessingTimeNotice = ({
  imageCount,
  onAcknowledge,
  acknowledged = false,
}: ProcessingTimeNoticeProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="marta-frame p-6 bg-gradient-to-br from-background via-muted/20 to-background"
    >
      {/* Krug-style headline */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Clock className="w-5 h-5 text-formanova-hero-accent" />
          <span className="marta-label text-muted-foreground text-[10px]">
            A note on time
          </span>
        </div>

        <h3 className="font-display text-xl md:text-2xl uppercase tracking-wide leading-tight">
          Great things take time.
          <br />
          <span className="text-formanova-hero-accent">Yours will too.</span>
        </h3>

        <div className="max-w-sm mx-auto space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Each image receives{' '}
            <span className="text-foreground font-medium">meticulous attention</span>
            —AI-powered precision that simply cannot be rushed.
          </p>

          <div className="flex items-center justify-center gap-2 py-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground font-mono">
              Up to 24 hours
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <p className="text-xs text-muted-foreground/80 italic">
            Most batches complete in 4–8 hours. We'll email you the moment they're ready.
          </p>
        </div>

        {/* Batch Summary */}
        <div className="pt-4 mt-4 border-t border-border/50">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-4 h-4 text-formanova-hero-accent" />
            <span className="text-sm">
              <span className="font-medium">{imageCount}</span>
              <span className="text-muted-foreground">
                {' '}image{imageCount !== 1 ? 's' : ''} queued for generation
              </span>
            </span>
          </div>
        </div>

        {/* Acknowledgment */}
        {onAcknowledge && (
          <motion.button
            onClick={onAcknowledge}
            disabled={acknowledged}
            whileHover={{ scale: acknowledged ? 1 : 1.02 }}
            whileTap={{ scale: acknowledged ? 1 : 0.98 }}
            className={`mt-4 px-6 py-3 marta-frame font-display text-sm uppercase tracking-wider transition-all ${
              acknowledged
                ? 'bg-formanova-hero-accent/20 text-formanova-hero-accent border-formanova-hero-accent/30'
                : 'bg-foreground text-background hover:bg-foreground/90'
            }`}
          >
            {acknowledged ? (
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                I understand
              </span>
            ) : (
              'I understand the timeline'
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

export default ProcessingTimeNotice;
