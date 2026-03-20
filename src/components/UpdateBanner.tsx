import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  visible: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
}

/**
 * Non-intrusive top banner that appears when a new version of Formanova is deployed.
 * Styled consistently with the HangingNotificationBanner / studio patterns.
 */
export function UpdateBanner({ visible, onRefresh, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full bg-muted/60 border-b border-border px-5 py-4 md:px-8 md:py-5 relative z-50"
        >
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 md:right-6 p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="max-w-3xl mx-auto pr-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-display text-sm md:text-base uppercase tracking-wider text-foreground">
                Formanova has been updated.
              </p>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                Refresh for the latest version.
              </p>
            </div>

            <Button
              variant="default"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={onRefresh}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh now
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
