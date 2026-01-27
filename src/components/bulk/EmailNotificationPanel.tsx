import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Check, Edit2 } from 'lucide-react';

interface EmailNotificationPanelProps {
  defaultEmail?: string;
  onEmailChange?: (email: string) => void;
}

const EmailNotificationPanel = ({
  defaultEmail = '',
  onEmailChange,
}: EmailNotificationPanelProps) => {
  const [email, setEmail] = useState(defaultEmail);
  const [isEditing, setIsEditing] = useState(!defaultEmail);

  const handleSave = () => {
    if (email && email.includes('@')) {
      setIsEditing(false);
      onEmailChange?.(email);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="marta-frame p-5 bg-gradient-to-br from-muted/30 to-transparent"
    >
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-4 h-4 text-formanova-hero-accent" />
        <span className="marta-label text-muted-foreground text-[10px]">
          Delivery
        </span>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-foreground">
          We'll email your results when ready
        </p>

        {isEditing ? (
          <div className="space-y-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 bg-background marta-frame text-sm focus:outline-none focus:border-formanova-hero-accent"
            />
            <button
              onClick={handleSave}
              disabled={!email || !email.includes('@')}
              className="w-full py-2 marta-frame text-xs font-mono uppercase tracking-wider bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-background/50 marta-frame">
            <div className="flex items-center gap-2 min-w-0">
              <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
              <span className="text-sm truncate">{email}</span>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
            >
              <Edit2 className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          Most batches complete in 4–8 hours. You can safely close this tab.
        </p>
      </div>
    </motion.div>
  );
};

export default EmailNotificationPanel;
