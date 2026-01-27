import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

// Import jewelry images
import heroNecklace from '@/assets/jewelry/hero-necklace-diamond.jpg';
import heroGreenEarrings from '@/assets/jewelry/hero-green-earrings.png';
import heroModelRings from '@/assets/jewelry/hero-model-rings.png';
import heroHandsBracelets from '@/assets/jewelry/hero-hands-bracelets.png';

export interface JewelryCategory {
  id: string;
  name: string;
  subtitle: string;
  image: string;
}

export const JEWELRY_CATEGORIES: JewelryCategory[] = [
  {
    id: 'necklace',
    name: 'Necklaces',
    subtitle: 'Chains & pendants',
    image: heroNecklace,
  },
  {
    id: 'earrings',
    name: 'Earrings',
    subtitle: 'Studs & drops',
    image: heroGreenEarrings,
  },
  {
    id: 'rings',
    name: 'Rings',
    subtitle: 'Bands & statement',
    image: heroModelRings,
  },
  {
    id: 'bracelets',
    name: 'Bracelets',
    subtitle: 'Bangles & cuffs',
    image: heroHandsBracelets,
  },
];

interface BulkCategorySelectorProps {
  selectedCategory: string | null;
  onSelectCategory: (category: JewelryCategory) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
    },
  },
};

const BulkCategorySelector = ({ selectedCategory, onSelectCategory }: BulkCategorySelectorProps) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <span className="marta-label text-muted-foreground">Step 1</span>
        <h2 className="font-display text-2xl md:text-3xl uppercase tracking-wide mt-1">
          Select Category
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Choose one jewelry type per batch
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3 md:gap-4"
      >
        {JEWELRY_CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category.id;
          
          return (
            <motion.button
              key={category.id}
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectCategory(category)}
              className={`group relative aspect-[4/3] marta-frame overflow-hidden cursor-pointer transition-all duration-300 ${
                isSelected 
                  ? 'border-formanova-hero-accent border-2 shadow-[0_0_20px_-5px_hsl(var(--formanova-hero-accent)/0.5)]' 
                  : 'hover:border-foreground/30'
              }`}
            >
              {/* Background Image */}
              <img
                src={category.image}
                alt={category.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
              
              {/* Overlay */}
              <div className={`absolute inset-0 transition-opacity duration-300 ${
                isSelected ? 'bg-background/20' : 'bg-background/40 group-hover:bg-background/30'
              }`} />

              {/* Gradient for text readability */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/90 to-transparent" />

              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-end p-4">
                <h3 className="font-display text-lg md:text-xl uppercase tracking-wide text-foreground">
                  {category.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {category.subtitle}
                </p>
              </div>

              {/* Worn photos badge */}
              <div className="absolute top-2 left-2">
                <span className="px-2 py-0.5 bg-background/80 backdrop-blur-sm text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                  Worn photos only
                </span>
              </div>

              {/* Selected checkmark */}
              {isSelected && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-6 h-6 bg-formanova-hero-accent flex items-center justify-center"
                >
                  <Check className="w-4 h-4 text-primary-foreground" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};

export default BulkCategorySelector;
