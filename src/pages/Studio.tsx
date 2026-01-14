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
    subtitle: 'Elegant chains & pendants',
    image: heroNecklace,
  },
  {
    id: 'earrings',
    name: 'Earrings',
    subtitle: 'Studs, hoops & drops',
    image: heroGreenEarrings,
  },
  {
    id: 'rings',
    name: 'Rings',
    subtitle: 'Bands & statement pieces',
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
    subtitle: 'Timepieces & smart accessories',
    image: heroChokerBack,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="pt-24 pb-12 px-6 md:px-12 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="max-w-7xl mx-auto"
        >
          <div className="marta-frame p-8 md:p-12 mb-8">
            <span className="font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase mb-4 block">
              Select Category
            </span>
            <h1 className="marta-headline text-foreground">
              Jewelry
              <span className="block text-formanova-hero-accent">Studio</span>
            </h1>
            <p className="font-body text-muted-foreground text-lg mt-6 max-w-xl">
              Choose your jewelry type to begin the AI-powered virtual try-on experience.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Categories Grid */}
      <section className="px-6 md:px-12 lg:px-24 pb-24">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-5xl mx-auto"
        >
          {/* Clean 2-column grid on desktop, single column on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((category) => (
              <motion.div
                key={category.id}
                variants={itemVariants}
                className="group relative"
              >
                <button
                  onClick={() => handleCategoryClick(category)}
                  className="w-full aspect-[4/3] marta-frame overflow-hidden cursor-pointer hover:border-foreground/40 transition-all duration-500"
                >
                  {/* Background Image */}
                  <div className="absolute inset-0 overflow-hidden">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="relative h-full flex flex-col justify-end p-6 md:p-8">
                    {/* Category Info */}
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase block">
                        {category.subtitle}
                      </span>
                      <h2 className="font-display text-3xl md:text-4xl uppercase tracking-wide text-foreground">
                        {category.name}
                      </h2>
                    </div>

                    {/* Arrow indicator */}
                    <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8">
                      <div className="w-10 h-10 marta-frame flex items-center justify-center bg-background/80 backdrop-blur-sm group-hover:bg-formanova-hero-accent group-hover:border-formanova-hero-accent transition-all duration-300">
                        <ArrowRight className="w-4 h-4 text-foreground group-hover:text-primary-foreground transition-colors duration-300" />
                      </div>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Bottom Info Section */}
      <section className="px-6 md:px-12 lg:px-24 pb-24">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="max-w-7xl mx-auto"
        >
          <div className="marta-divider mb-8" />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              AI-Powered Virtual Try-On
            </p>
            <p className="font-body text-sm text-muted-foreground">
              Professional jewelry visualization for fashion brands
            </p>
          </div>
        </motion.div>
      </section>
    </div>
  );
};

export default Studio;
