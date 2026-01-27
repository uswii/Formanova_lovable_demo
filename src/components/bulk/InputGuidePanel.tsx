import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

// Example images
import earringWornExample from '@/assets/examples/earring-worn-example.jpg';
import necklacePearlStrand from '@/assets/examples/necklace-pearl-strand.jpg';

interface InputGuidePanelProps {
  categoryName: string;
}

// Category-specific guide content
const CATEGORY_GUIDES: Record<string, {
  goodLabel: string;
  badLabel: string;
  goodImage: string;
  tip: string;
}> = {
  Necklaces: {
    goodLabel: 'Worn or on mannequin',
    badLabel: 'Flatlay / CAD render',
    goodImage: necklacePearlStrand,
    tip: 'Best results with neck/chest visible',
  },
  Earrings: {
    goodLabel: 'Worn',
    badLabel: 'Flatlay',
    goodImage: earringWornExample,
    tip: 'Ear and hair visible works best',
  },
  Rings: {
    goodLabel: 'Worn on hand',
    badLabel: 'Flatlay',
    goodImage: necklacePearlStrand,
    tip: 'Natural hand pose recommended',
  },
  Bracelets: {
    goodLabel: 'Worn on wrist',
    badLabel: 'Flatlay',
    goodImage: necklacePearlStrand,
    tip: 'Wrist and forearm visible',
  },
  Watches: {
    goodLabel: 'Worn on wrist',
    badLabel: 'Flatlay',
    goodImage: necklacePearlStrand,
    tip: 'Natural wrist position',
  },
};

const InputGuidePanel = ({ categoryName }: InputGuidePanelProps) => {
  const guide = CATEGORY_GUIDES[categoryName] || CATEGORY_GUIDES.Necklaces;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-4"
    >
      <span className="marta-label text-muted-foreground text-[10px]">
        Input Guide
      </span>

      {/* Good Example */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-3 h-3 text-green-500" />
          </div>
          <span className="text-xs font-medium text-foreground">{guide.goodLabel}</span>
        </div>
        <div className="aspect-[3/4] marta-frame overflow-hidden bg-muted/30">
          <img
            src={guide.goodImage}
            alt="Good example"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Bad Example - just text, no image needed */}
      <div className="flex items-center gap-2 py-2 px-3 bg-destructive/10 marta-frame border-destructive/20">
        <X className="w-4 h-4 text-destructive" />
        <span className="text-xs text-destructive">{guide.badLabel}</span>
      </div>

      {/* Tip */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {guide.tip}
      </p>
    </motion.div>
  );
};

export default InputGuidePanel;
