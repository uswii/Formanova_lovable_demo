import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Pencil, X, Mail, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
}: BatchSubmittedConfirmationProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState(user?.email || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEmail = async () => {
    if (!batchId || !notificationEmail) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('batch_jobs')
        .update({ notification_email: notificationEmail })
        .eq('id', batchId);
      
      if (error) throw error;
      
      toast({
        title: 'Email updated',
        description: `Results will be sent to ${notificationEmail}`,
      });
      setIsEditingEmail(false);
    } catch (err) {
      console.error('Failed to update email:', err);
      toast({
        title: 'Failed to update email',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

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
        
        <p className="text-muted-foreground mb-6">
          Your <span className="text-foreground">{imageCount} {categoryName.toLowerCase()}</span> photoshoots 
          are being created and verified for accuracy.
        </p>

        {/* Email notification section */}
        <div className="bg-muted/30 rounded-lg p-4 mb-6">
          {isEditingEmail ? (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-formanova-hero-accent"
                placeholder="Enter email"
                autoFocus
              />
              <button
                onClick={handleSaveEmail}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs bg-formanova-hero-accent text-primary-foreground rounded hover:bg-formanova-hero-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                Save
              </button>
              <button
                onClick={() => {
                  setNotificationEmail(user?.email || '');
                  setIsEditingEmail(false);
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Results will be sent to{' '}
                <span className="text-foreground font-medium">{notificationEmail}</span>
              </span>
              <button
                onClick={() => setIsEditingEmail(true)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Edit email"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Timeline message */}
        <p className="text-sm text-muted-foreground">
          We'll get back to you within <span className="text-foreground font-medium">24 hours</span>
        </p>
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
