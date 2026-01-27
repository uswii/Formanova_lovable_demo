import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

// Necklace examples
import necklaceAllowed1 from '@/assets/examples/necklace-allowed-1.jpg';
import necklaceAllowed2 from '@/assets/examples/necklace-allowed-2.jpg';
import necklaceAllowed3 from '@/assets/examples/necklace-allowed-3.jpg';
import necklaceNotAllowed1 from '@/assets/examples/necklace-notallowed-1.png';
import necklaceNotAllowed2 from '@/assets/examples/necklace-notallowed-2.png';
import necklaceNotAllowed3 from '@/assets/examples/necklace-notallowed-3.png';

// Earring examples
import earringAllowed1 from '@/assets/examples/earring-allowed-1.jpg';
import earringAllowed2 from '@/assets/examples/earring-allowed-2.jpg';
import earringAllowed3 from '@/assets/examples/earring-allowed-3.jpg';
import earringNotAllowed1 from '@/assets/examples/earring-notallowed-1.png';
import earringNotAllowed2 from '@/assets/examples/earring-notallowed-2.png';
import earringNotAllowed3 from '@/assets/examples/earring-notallowed-3.png';

// Bracelet examples
import braceletAllowed1 from '@/assets/examples/bracelet-allowed-1.jpg';
import braceletAllowed2 from '@/assets/examples/bracelet-allowed-2.jpg';
import braceletAllowed3 from '@/assets/examples/bracelet-allowed-3.jpg';
import braceletNotAllowed1 from '@/assets/examples/bracelet-notallowed-1.png';
import braceletNotAllowed2 from '@/assets/examples/bracelet-notallowed-2.png';
import braceletNotAllowed3 from '@/assets/examples/bracelet-notallowed-3.png';

// Watch examples
import watchAllowed1 from '@/assets/examples/watch-allowed-1.jpg';
import watchAllowed2 from '@/assets/examples/watch-allowed-2.jpg';
import watchAllowed3 from '@/assets/examples/watch-allowed-3.png';
import watchNotAllowed1 from '@/assets/examples/watch-notallowed-1.png';
import watchNotAllowed2 from '@/assets/examples/watch-notallowed-2.png';
import watchNotAllowed3 from '@/assets/examples/watch-notallowed-3.png';

interface ExampleGuidePanelProps {
  categoryName?: string;
  categoryType?: string;
}

const CATEGORY_EXAMPLES: Record<string, { allowed: string[]; notAllowed: string[] }> = {
  necklace: {
    allowed: [necklaceAllowed1, necklaceAllowed2, necklaceAllowed3],
    notAllowed: [necklaceNotAllowed1, necklaceNotAllowed2, necklaceNotAllowed3],
  },
  earrings: {
    allowed: [earringAllowed1, earringAllowed2, earringAllowed3],
    notAllowed: [earringNotAllowed1, earringNotAllowed2, earringNotAllowed3],
  },
  bracelets: {
    allowed: [braceletAllowed1, braceletAllowed2, braceletAllowed3],
    notAllowed: [braceletNotAllowed1, braceletNotAllowed2, braceletNotAllowed3],
  },
  watches: {
    allowed: [watchAllowed1, watchAllowed2, watchAllowed3],
    notAllowed: [watchNotAllowed1, watchNotAllowed2, watchNotAllowed3],
  },
};

// Default to necklace for other categories until we have their examples
const DEFAULT_EXAMPLES = CATEGORY_EXAMPLES.necklace;

const ExampleGuidePanel = ({ categoryName = 'Jewelry', categoryType = 'earrings' }: ExampleGuidePanelProps) => {
  const examples = CATEGORY_EXAMPLES[categoryType] || DEFAULT_EXAMPLES;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Allowed examples */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-green-500" />
          </div>
          <span className="text-xs font-medium text-foreground">Good Examples</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {examples.allowed.map((img, index) => (
            <div
              key={`allowed-${index}`}
              className="relative aspect-[3/4] rounded-md overflow-hidden border border-green-500/30"
            >
              <img
                src={img}
                alt={`Good example ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shadow">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Worn on person
        </p>
      </div>

      {/* Not allowed examples */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-destructive/20 flex items-center justify-center">
            <X className="w-2.5 h-2.5 text-destructive" />
          </div>
          <span className="text-xs font-medium text-foreground">Not Accepted</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {examples.notAllowed.map((img, index) => (
            <div
              key={`notallowed-${index}`}
              className="relative aspect-[3/4] rounded-md overflow-hidden border border-destructive/30"
            >
              <img
                src={img}
                alt={`Not accepted ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center shadow">
                <X className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Product shots without model
        </p>
      </div>
    </motion.div>
  );
};

export default ExampleGuidePanel;
