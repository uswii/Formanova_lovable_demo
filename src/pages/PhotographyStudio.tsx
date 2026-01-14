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
    subtitle: 'Bands & statement',
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

const PhotographyStudio = () => {
  const navigate = useNavigate();

  const handleCategoryClick = (category: JewelryCategory) => {
    navigate(`/studio/${category.id}`);
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-6 px-6 md:px-12 lg:px-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto mb-6 flex items-end justify-between"
      >
        <div>
          <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-1">
            Select Category
          </span>
        </div>
        <p className="hidden md:block font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
          AI-powered try-on
        </p>
      </motion.div>

      {/* Categories Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-4"
      >
        {categories.map((category, index) => (
          <motion.button
            key={category.id}
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleCategoryClick(category)}
            className={`group relative aspect-[4/3] marta-frame overflow-hidden cursor-pointer transition-all duration-300 hover:border-formanova-hero-accent hover:shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)] ${
              index === 4 ? 'col-span-2 md:col-span-1 aspect-[8/3] md:aspect-[4/3]' : ''
            }`}
          >
            {/* Background Image */}
            <img
              src={category.image}
              alt={category.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
            
            {/* Gradient Overlay - intensifies on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent transition-opacity duration-300 group-hover:opacity-80" />
            
            {/* Glow overlay on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-formanova-hero-accent/10 via-transparent to-transparent" />

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6 text-left">
              <span className="font-mono text-[9px] md:text-[10px] tracking-[0.2em] text-muted-foreground uppercase block mb-1 transition-colors duration-300 group-hover:text-formanova-hero-accent">
                {category.subtitle}
              </span>
              <h2 className="font-display text-xl md:text-2xl lg:text-3xl uppercase tracking-wide text-foreground transition-transform duration-300 group-hover:translate-x-1">
                {category.name}
              </h2>
            </div>

            {/* Arrow indicator */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0 translate-x-2">
              <div className="w-9 h-9 flex items-center justify-center bg-formanova-hero-accent shadow-lg shadow-formanova-hero-accent/30">
                <ArrowRight className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
};

export default PhotographyStudio;
