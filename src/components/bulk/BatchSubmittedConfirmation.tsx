import { motion } from 'framer-motion';
import { Check, Mail, ExternalLink, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="text-center space-y-8 max-w-md mx-auto"
    >
      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-20 h-20 mx-auto bg-formanova-success flex items-center justify-center"
      >
        <Check className="w-10 h-10 text-primary-foreground" />
      </motion.div>

      {/* Main Message */}
      <div className="space-y-3">
        <h2 className="font-display text-3xl md:text-4xl uppercase tracking-wide">
          Batch Submitted
        </h2>
        <p className="text-muted-foreground leading-relaxed italic">
          "Our masters are now meticulously rendering your {categoryName} collection. Excellence takes time."
        </p>
      </div>

      {/* Set and Forget Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="marta-frame p-6 bg-muted/30 space-y-4"
      >
        <div className="flex items-center justify-center gap-2 text-formanova-hero-accent">
          <Mail className="w-5 h-5" />
          <span className="font-medium">Email Notification</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You can safely <span className="text-foreground font-medium">close this tab</span>. 
          We'll email you the moment your {imageCount} photoshoots are ready.
        </p>
      </motion.div>

      {/* Delivery Estimate */}
      <div className="text-sm text-muted-foreground">
        <p>Expected delivery: <span className="text-foreground font-medium">Within 24 hours</span></p>
        <p className="text-xs mt-1 italic">(Usually faster — we'll surprise you!)</p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <button
          onClick={() => navigate('/batches')}
          className="flex-1 py-3 px-6 marta-frame text-sm font-mono uppercase tracking-wider hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          View Batch Status
        </button>
        <button
          onClick={onStartAnother}
          className="flex-1 py-3 px-6 marta-frame bg-formanova-hero-accent text-primary-foreground text-sm font-mono uppercase tracking-wider hover:bg-formanova-hero-accent/90 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Start Another Batch
        </button>
      </div>

      {/* Batch ID */}
      {batchId && (
        <p className="text-[10px] font-mono text-muted-foreground/60">
          Batch ID: {batchId}
        </p>
      )}
    </motion.div>
  );
};

export default BatchSubmittedConfirmation;
