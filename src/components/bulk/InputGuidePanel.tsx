import { motion } from 'framer-motion';
import { Check, X, Info } from 'lucide-react';

// Import example images
import mannequinJewelry from '@/assets/tutorial/mannequin-jewelry.jpg';
import mannequinNecklace from '@/assets/tutorial/mannequin-necklace-studio.jpg';

interface InputGuidePanelProps {
  categoryName: string;
}

const InputGuidePanel = ({ categoryName }: InputGuidePanelProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="space-y-1">
        <span className="marta-label text-muted-foreground text-[10px]">Input Guide</span>
        <h3 className="font-display text-lg uppercase tracking-wide">
          What Works Best
        </h3>
      </div>

      {/* Accepted Inputs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-emerald-500">
          <Check className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Accepted</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="marta-frame overflow-hidden aspect-[4/5] relative group">
            <img 
              src={mannequinJewelry} 
              alt="Jewelry on mannequin" 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <span className="text-[10px] text-white/90 font-mono">On mannequin</span>
            </div>
          </div>
          <div className="marta-frame overflow-hidden aspect-[4/5] relative group">
            <img 
              src={mannequinNecklace} 
              alt="Jewelry on model" 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <span className="text-[10px] text-white/90 font-mono">On model</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {categoryName} photographed on a mannequin, bust, or worn by a model work best.
        </p>
      </div>

      {/* Rejected Inputs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-rose-500">
          <X className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Not Accepted</span>
        </div>
        
        <div className="marta-frame p-4 bg-rose-500/5 border-rose-500/20">
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <X className="w-3 h-3 text-rose-500 mt-0.5 flex-shrink-0" />
              <span>Flat lay product shots</span>
            </li>
            <li className="flex items-start gap-2">
              <X className="w-3 h-3 text-rose-500 mt-0.5 flex-shrink-0" />
              <span>Jewelry on plain backgrounds without form</span>
            </li>
            <li className="flex items-start gap-2">
              <X className="w-3 h-3 text-rose-500 mt-0.5 flex-shrink-0" />
              <span>CAD renders or 3D mockups</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Pro Tip */}
      <div className="marta-frame p-3 bg-formanova-hero-accent/5 border-formanova-hero-accent/20">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-formanova-hero-accent flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">Pro tip:</span> High-resolution images with clear jewelry visibility yield the best results.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default InputGuidePanel;
