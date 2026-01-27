import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface BatchSubmittedConfirmationProps {
  categoryName: string;
  imageCount: number;
  batchId?: string;
  onStartAnother: () => void;
}

const BatchSubmittedConfirmation = ({
  categoryName,
  imageCount,
  batchId,
  onStartAnother,
}: BatchSubmittedConfirmationProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center"
        >
          <Check className="w-8 h-8 text-green-500" />
        </motion.div>

        {/* Main Message */}
        <h2 className="font-display text-2xl md:text-3xl uppercase tracking-wide mb-3">
          We're on it
        </h2>
        
        <p className="text-muted-foreground mb-8">
          Your <span className="text-foreground">{imageCount} {categoryName.toLowerCase()}</span> photoshoots 
          are being created and verified for accuracy.
        </p>

        {/* Email info - simple inline */}
        {user?.email && (
          <p className="text-sm text-muted-foreground mb-8">
            Results will be sent to <span className="text-foreground font-medium">{user.email}</span>
          </p>
        )}

        {/* Primary Action */}
        <button
          onClick={onStartAnother}
          className="inline-flex items-center gap-2 px-8 py-3 bg-formanova-hero-accent text-primary-foreground font-display text-sm uppercase tracking-wider rounded-lg hover:bg-formanova-hero-accent/90 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Create Another Batch
        </button>
      </motion.div>

      {/* Footer info - subtle, corner placement */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="absolute bottom-6 left-6 text-xs text-muted-foreground/60"
      >
        <button
          onClick={() => navigate('/batches')}
          className="hover:text-muted-foreground transition-colors"
        >
          View batch status →
        </button>
        {batchId && (
          <span className="ml-3 font-mono">{batchId}</span>
        )}
      </motion.div>
    </div>
  );
};

export default BatchSubmittedConfirmation;
