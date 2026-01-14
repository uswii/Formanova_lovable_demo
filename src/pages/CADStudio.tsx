import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';

// Import jewelry images
import heroModelRings from '@/assets/jewelry/hero-model-rings.png';
import heroNecklace from '@/assets/jewelry/hero-necklace-diamond.jpg';
import heroGreenEarrings from '@/assets/jewelry/hero-green-earrings.png';
import heroHandsBracelets from '@/assets/jewelry/hero-hands-bracelets.png';
import heroWatch from '@/assets/jewelry/hero-watch.png';

interface JewelryCategory {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  available: boolean;
}

const categories: JewelryCategory[] = [
  {
    id: 'rings',
    name: 'Rings',
    subtitle: 'Bands & statement',
    image: heroModelRings,
    available: true,
  },
  {
    id: 'necklace',
    name: 'Necklaces',
    subtitle: 'Chains & pendants',
    image: heroNecklace,
    available: false,
  },
  {
    id: 'earrings',
    name: 'Earrings',
    subtitle: 'Studs & drops',
    image: heroGreenEarrings,
    available: false,
  },
  {
    id: 'bracelets',
    name: 'Bracelets',
    subtitle: 'Bangles & cuffs',
    image: heroHandsBracelets,
    available: false,
  },
  {
    id: 'watches',
    name: 'Watches',
    subtitle: 'Timepieces',
    image: heroWatch,
    available: false,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

const CADStudio = () => {
  const navigate = useNavigate();

  const handleCategoryClick = (category: JewelryCategory) => {
    if (category.available) {
      navigate(`/studio-cad/${category.id}`);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-6 px-4 md:px-6 lg:px-8 flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 flex items-end justify-between"
      >
        <div>
          <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-1">
            Select Category
          </span>
        </div>
        <p className="hidden md:block font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
          CAD to Photo Rendering
        </p>
      </motion.div>

      {/* Categories Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 content-center"
      >
        {categories.map((category, index) => (
          <motion.button
            key={category.id}
            variants={itemVariants}
            whileHover={category.available ? { scale: 1.02, y: -4 } : {}}
            whileTap={category.available ? { scale: 0.98 } : {}}
            onClick={() => handleCategoryClick(category)}
            disabled={!category.available}
            className={`group relative aspect-[4/3] marta-frame overflow-hidden transition-all duration-300 ${
              category.available 
                ? 'cursor-pointer hover:border-formanova-hero-accent hover:shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)]' 
                : 'cursor-not-allowed opacity-70'
            }`}
          >
            {/* Background Image */}
            <img
              src={category.image}
              alt={category.name}
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out ${
                category.available ? 'group-hover:scale-110' : 'grayscale'
              } ${category.id === 'necklace' ? 'object-[center_30%]' : ''}`}
            />
            
            {/* Subtle gradient at bottom for text readability */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/80 to-transparent" />

            {/* Coming Soon Overlay */}
            {!category.available && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                <div className="flex items-center gap-2 bg-background/80 px-4 py-2 rounded-full border border-border">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    Coming Soon
                  </span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6 text-left">
              <h2 className={`font-display text-xl md:text-2xl lg:text-3xl uppercase tracking-wide text-foreground transition-transform duration-300 ${
                category.available ? 'group-hover:translate-x-1' : ''
              }`}>
                {category.name}
              </h2>
            </div>

            {/* Arrow indicator - only for available categories */}
            {category.available && (
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0 translate-x-2">
                <ArrowRight className="h-5 w-5 text-foreground" />
              </div>
            )}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
};

export default CADStudio;
