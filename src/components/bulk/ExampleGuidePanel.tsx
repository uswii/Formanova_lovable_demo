import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

// Allowed examples - earrings worn on model
import allowedImg1 from '@/assets/examples/earring-allowed-1.jpg';
import allowedImg2 from '@/assets/examples/earring-allowed-2.jpg';
import allowedImg3 from '@/assets/examples/earring-allowed-3.jpg';

// Not allowed examples - product flatlays
import notAllowedImg1 from '@/assets/examples/earring-notallowed-1.png';
import notAllowedImg2 from '@/assets/examples/earring-notallowed-2.png';
import notAllowedImg3 from '@/assets/examples/earring-notallowed-3.png';

interface ExampleGuidePanelProps {
  categoryName?: string;
}

const ExampleGuidePanel = ({ categoryName = 'Jewelry' }: ExampleGuidePanelProps) => {
  const allowedImages = [allowedImg1, allowedImg2, allowedImg3];
  const notAllowedImages = [notAllowedImg1, notAllowedImg2, notAllowedImg3];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Allowed examples */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-3 h-3 text-green-500" />
          </div>
          <span className="text-sm font-medium text-foreground">Good Examples</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {allowedImages.map((img, index) => (
            <div
              key={`allowed-${index}`}
              className="relative aspect-square rounded-lg overflow-hidden border border-green-500/30"
            >
              <img
                src={img}
                alt={`Good example ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Tick mark badge */}
              <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {categoryName} worn on a model/person
        </p>
      </div>

      {/* Not allowed examples */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center">
            <X className="w-3 h-3 text-destructive" />
          </div>
          <span className="text-sm font-medium text-foreground">Not Accepted</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {notAllowedImages.map((img, index) => (
            <div
              key={`notallowed-${index}`}
              className="relative aspect-square rounded-lg overflow-hidden border border-destructive/30"
            >
              <img
                src={img}
                alt={`Not accepted ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {/* X badge */}
              <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center shadow-lg">
                <X className="w-3 h-3 text-white" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Product-only shots without model
        </p>
      </div>
    </motion.div>
  );
};

export default ExampleGuidePanel;
