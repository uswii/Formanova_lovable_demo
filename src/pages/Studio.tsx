import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Import jewelry images
import heroNecklace from '@/assets/jewelry/hero-necklace.jpg';
import heroGreenEarrings from '@/assets/jewelry/hero-green-earrings.png';
import heroModelRings from '@/assets/jewelry/hero-model-rings.png';
import heroHandsBracelets from '@/assets/jewelry/hero-hands-bracelets.png';
import heroChokerBack from '@/assets/jewelry/hero-choker-back.png';

interface JewelryCategory {
  id: string;
  name: string;
  subtitle: string;
  image: string;
}

const categories: JewelryCategory[] = [
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
    subtitle: 'Bands & pieces',
    image: heroModelRings,
  },
  {
    id: 'bracelets',
    name: 'Bracelets',
    subtitle: 'Bangles & cuffs',
    image: heroHandsBracelets,
  },
  {
    id: 'watches',
    name: 'Watches',
    subtitle: 'Timepieces',
    image: heroChokerBack,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
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
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

const Studio = () => {
  const navigate = useNavigate();

  const handleCategoryClick = (category: JewelryCategory) => {
    navigate(`/studio/${category.id}`);
  };

  return (
    <div className="h-[calc(100vh-5rem)] bg-background flex flex-col overflow-hidden">
      {/* Compact Header */}
      <div className="flex-shrink-0 px-6 md:px-12 pt-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between"
        >
          <div>
            <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase block mb-1">
              Select Category
            </span>
            <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight text-foreground">
              Jewelry <span className="text-formanova-hero-accent">Studio</span>
            </h1>
          </div>
          <p className="hidden md:block font-body text-sm text-muted-foreground max-w-xs text-right">
            AI-powered virtual try-on
          </p>
        </motion.div>
      </div>

      {/* Categories Grid - Fills remaining space */}
      <div className="flex-1 px-6 md:px-12 pb-6 min-h-0">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="h-full max-w-6xl mx-auto"
        >
          {/* 5 columns on large screens, 3 on medium, 2 on small */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 h-full">
            {categories.map((category) => (
              <motion.div
                key={category.id}
                variants={itemVariants}
                className="group relative"
              >
                <button
                  onClick={() => handleCategoryClick(category)}
                  className="w-full h-full marta-frame overflow-hidden cursor-pointer hover:border-foreground/40 transition-all duration-300"
                >
                  {/* Background Image */}
                  <div className="absolute inset-0 overflow-hidden">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="relative h-full flex flex-col justify-end p-4">
                    {/* Category Info */}
                    <div className="space-y-0.5">
                      <span className="font-mono text-[8px] md:text-[9px] tracking-[0.2em] text-muted-foreground uppercase block">
                        {category.subtitle}
                      </span>
                      <h2 className="font-display text-lg md:text-xl lg:text-2xl uppercase tracking-wide text-foreground">
                        {category.name}
                      </h2>
                    </div>

                    {/* Arrow indicator */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-8 h-8 marta-frame flex items-center justify-center bg-formanova-hero-accent border-formanova-hero-accent">
                        <ArrowRight className="w-3 h-3 text-primary-foreground" />
                      </div>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Studio;
