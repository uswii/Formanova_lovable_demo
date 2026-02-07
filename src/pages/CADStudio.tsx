import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';

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
    available: false,
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
          CAD to Photo Rendering
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
          <motion.div
            key={category.id}
            variants={itemVariants}
            className={`group relative aspect-[4/3] marta-frame overflow-hidden transition-all duration-300 opacity-90 ${
              index === 4 ? 'col-span-2 md:col-span-1 aspect-[8/3] md:aspect-[4/3]' : ''
            }`}
          >
            {/* Background Image */}
            <img
              src={category.image}
              alt={category.name}
              className="absolute inset-0 w-full h-full object-cover grayscale-[30%]"
            />
            
            {/* Gradient for readability */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/90 to-transparent" />

            {/* Access Notice Overlay */}
            <div className="absolute inset-0 bg-background/40 flex items-center justify-center p-4">
              <div className="flex flex-col items-center gap-2 bg-background/80 backdrop-blur-sm px-5 py-3 rounded-lg border border-border/60 text-center max-w-[90%]">
                <Mail className="h-4 w-4 text-primary" />
                <span className="font-mono text-[9px] md:text-[10px] tracking-[0.15em] text-muted-foreground leading-relaxed">
                  Available to select jewelry brands.{' '}
                  <a
                    href="mailto:sophia@raresense.so"
                    className="text-primary hover:underline font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Email sophia@raresense.so
                  </a>{' '}
                  to request access.
                </span>
              </div>
            </div>

            {/* Category Name */}
            <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6 text-left pointer-events-none">
              <h2 className="font-display text-xl md:text-2xl lg:text-3xl uppercase tracking-wide text-foreground">
                {category.name}
              </h2>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Video */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="max-w-4xl mx-auto mt-10"
      >
        <div className="aspect-video w-full rounded-lg overflow-hidden border border-border/40">
          <iframe
            src="https://www.youtube.com/embed/OYvhYxGzQAY"
            title="CAD to Photo Rendering"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </motion.div>
    </div>
  );
};

export default CADStudio;
